import fs from "node:fs";
import { z } from "zod";
import { validateArgs, extractBaseCommand, createSafeEnvironment, auditLog } from "../security/index.js";
import { executeCommand, getActiveExecutions, incrementActiveExecutions, decrementActiveExecutions } from "../execution/index.js";
import { readFileChunk, createCursor, hashFilePrefix } from "../filesystem/index.js";
import { WORKSPACE_ROOT, EXEC_ENABLE_STREAMING, CHUNK_SIZE } from "../config/constants.js";

export const metadata = {
  title: "Shell Command Execution",
  description: "Execute a shell command in the workspace with real-time output streaming. STDOUT/STDERR stream via SSE notifications. Complete output saved to log file for later retrieval.",
  inputSchema: z.object({
    command: z.string(),
    args: z.array(z.string()).optional(),
    timeout: z.number().optional()
  }),
  annotations: {
    readOnlyHint: false
  }
};

export async function handler({ command, args, timeout }, extra, server, shellExecConfig) {
  const providedArgs = args || [];

  // 1. Extract and validate base command
  let baseCommand;
  try {
    baseCommand = shellExecConfig.validate_command
      ? extractBaseCommand(command)
      : command.trim().split(/\s+/)[0];
  } catch (error) {
    auditLog(extra?.sessionId, command, providedArgs, false, 'invalid_command');
    throw error;
  }

  // 2. Check against blocked commands list
  if (shellExecConfig.block_dangerous && shellExecConfig.blocked_commands) {
    if (shellExecConfig.blocked_commands.includes(baseCommand)) {
      auditLog(extra?.sessionId, baseCommand, providedArgs, false, 'blocked_command');
      throw new Error(
        `Command '${baseCommand}' is explicitly blocked for security reasons`
      );
    }
  }

  // 3. Check against whitelist (unless allow_all or permissive mode)
  if (shellExecConfig.require_whitelist && !shellExecConfig.allow_all) {
    if (!shellExecConfig.allowed_commands.includes(baseCommand)) {
      auditLog(extra?.sessionId, baseCommand, providedArgs, false, 'not_whitelisted');
      throw new Error(
        `Command '${baseCommand}' not allowed. Allowed commands: ${shellExecConfig.allowed_commands.join(', ') || 'none'}`
      );
    }
  }

  // 4. Validate arguments
  if (shellExecConfig.validate_args && providedArgs.length > 0) {
    const maxArgs = shellExecConfig.max_args || 100;
    const maxArgLength = shellExecConfig.max_arg_length || 10000;

    if (providedArgs.length > maxArgs) {
      auditLog(extra?.sessionId, baseCommand, providedArgs, false, 'too_many_args');
      throw new Error(`Too many arguments (max ${maxArgs})`);
    }

    for (const arg of providedArgs) {
      if (arg.length > maxArgLength) {
        auditLog(extra?.sessionId, baseCommand, providedArgs, false, 'arg_too_long');
        throw new Error(`Argument too long (max ${maxArgLength} chars)`);
      }
    }

    try {
      validateArgs(providedArgs);
    } catch (error) {
      auditLog(extra?.sessionId, baseCommand, providedArgs, false, 'dangerous_arg_pattern');
      throw error;
    }
  }

  // 5. Check resource limits
  const maxConcurrent = shellExecConfig.max_concurrent_executions || 3;
  if (getActiveExecutions() >= maxConcurrent) {
    auditLog(extra?.sessionId, baseCommand, providedArgs, false, 'max_concurrent_reached');
    throw new Error(`Too many concurrent executions (max ${maxConcurrent})`);
  }

  // 6. Validate timeout
  const resolvedTimeout = Math.min(
    timeout || shellExecConfig.default_timeout,
    shellExecConfig.max_timeout
  );

  // 7. Audit log - command allowed
  auditLog(extra?.sessionId, baseCommand, providedArgs, true, 'starting');

  // 8. Send start notification
  if (EXEC_ENABLE_STREAMING && extra?.sessionId) {
    try {
      await server.sendLoggingMessage({
        level: 'info',
        data: `[shell.exec] Starting: ${baseCommand} ${providedArgs.join(' ')}`
      }, extra.sessionId);
    } catch (error) {
      console.error('Failed to send start notification:', error);
    }
  }

  // 9. Create streaming callback
  const streamCallback = EXEC_ENABLE_STREAMING && extra?.sessionId
    ? async (stream, chunk) => {
        try {
          await server.sendLoggingMessage({
            level: stream === 'stderr' ? 'warning' : 'info',
            data: chunk
          }, extra.sessionId);
        } catch (error) {
          console.error('Failed to stream output:', error);
        }
      }
    : null;

  // 10. Execute command with safeguards
  incrementActiveExecutions();
  let result;
  try {
    result = await executeCommand(
      baseCommand,
      providedArgs,
      {
        cwd: WORKSPACE_ROOT,
        timeout: resolvedTimeout,
        env: shellExecConfig.restrict_environment ? createSafeEnvironment() : process.env
      },
      shellExecConfig,
      streamCallback
    );
  } catch (error) {
    decrementActiveExecutions();
    auditLog(extra?.sessionId, baseCommand, providedArgs, true, `error: ${error.message}`);
    throw error;
  }
  decrementActiveExecutions();

  // 11. Audit log - command completed
  auditLog(extra?.sessionId, baseCommand, providedArgs, true, `completed: exit ${result.exitCode}`);

  // 12. Send completion notification
  if (EXEC_ENABLE_STREAMING && extra?.sessionId) {
    try {
      await server.sendLoggingMessage({
        level: result.exitCode === 0 ? 'info' : 'error',
        data: `[shell.exec] Completed with exit code ${result.exitCode}`
      }, extra.sessionId);
    } catch (error) {
      console.error('Failed to send completion notification:', error);
    }
  }

  // 13. Read first chunk of log file (backward compatibility)
  let firstChunk = '';
  let hasMore = false;
  let nextCursor;

  if (result.logSize > 0) {
    if (result.logSize <= CHUNK_SIZE) {
      firstChunk = await fs.promises.readFile(result.logFile, { encoding: 'utf8' });
    } else {
      const logHash = await hashFilePrefix(result.logFile);
      const chunk = await readFileChunk(result.logFile, 0, CHUNK_SIZE, 'utf8');
      firstChunk = chunk.content;
      hasMore = chunk.hasMore;
      nextCursor = chunk.hasMore
        ? createCursor('file', result.logFile, chunk.chunkSize, logHash)
        : undefined;
    }
  }

  const response = {
    command: `${baseCommand} ${providedArgs.join(' ')}`.trim(),
    exitCode: result.exitCode,
    stdout: firstChunk,
    stderr: result.stderr,
    logFile: result.logFile,
    logSize: result.logSize,
    hasMore,
    nextCursor,
    streamed: EXEC_ENABLE_STREAMING && extra?.sessionId ? true : false,
    note: hasMore ? `Use fs.read with cursor to read remaining ${result.logSize - firstChunk.length} bytes from log file` : undefined
  };

  return {
    content: [{ type: "text", text: JSON.stringify(response, null, 2) }],
    structuredContent: response
  };
}

import fs from "node:fs";
import path from "node:path";
import { EXEC_LOG_DIR, WORKSPACE_ROOT } from "../config/constants.js";

// Execute command with output redirected to log file
export async function executeCommand(command, args, options, shellConfig, streamCallback = null) {
  const { spawn } = await import("node:child_process");

  // Create log directory
  await fs.promises.mkdir(EXEC_LOG_DIR, { recursive: true });

  // Generate unique log file
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).slice(2, 8);
  const logFile = path.join(EXEC_LOG_DIR, `${timestamp}-${randomId}.log`);

  return new Promise((resolve, reject) => {
    const logStream = fs.createWriteStream(logFile);
    let stderr = '';

    const proc = spawn(command, args, {
      cwd: options.cwd || WORKSPACE_ROOT,
      timeout: options.timeout || shellConfig.default_timeout,
      env: options.env || process.env,
      shell: false,  // CRITICAL: Never enable shell interpretation
      stdio: ['ignore', 'pipe', 'pipe']
    });

    // Stream stdout chunks in real-time
    proc.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      logStream.write(chunk);  // Still write to log file

      // Real-time streaming callback
      if (streamCallback) {
        streamCallback('stdout', text).catch(err => {
          console.error('Stream callback error:', err);
        });
      }
    });

    // Stream stderr chunks in real-time
    proc.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      stderr += text;  // Accumulate for final result

      // Real-time streaming callback
      if (streamCallback) {
        streamCallback('stderr', text).catch(err => {
          console.error('Stream callback error:', err);
        });
      }
    });

    proc.on('close', async (code) => {
      logStream.end();

      // Get log file size
      const stat = await fs.promises.stat(logFile);

      resolve({
        exitCode: code,
        logFile,
        logSize: stat.size,
        stderr
      });
    });

    proc.on('error', (err) => {
      logStream.end();
      reject(err);
    });
  });
}

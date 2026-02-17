import fs from "node:fs";
import path from "node:path";
import { EXEC_AUDIT_ENABLED, EXEC_AUDIT_LOG } from "../config/constants.js";

// Security: Audit log for command executions
export function auditLog(sessionId, command, args, allowed, result = null) {
  if (!EXEC_AUDIT_ENABLED) {
    return;
  }

  const entry = {
    timestamp: new Date().toISOString(),
    sessionId: sessionId || 'unknown',
    command,
    args: args || [],
    allowed,
    result: result || (allowed ? 'executed' : 'blocked')
  };

  try {
    // Ensure audit log directory exists
    const logDir = path.dirname(EXEC_AUDIT_LOG);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    fs.appendFileSync(EXEC_AUDIT_LOG, JSON.stringify(entry) + '\n');
  } catch (error) {
    console.error('Failed to write audit log:', error);
  }
}

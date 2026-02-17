export const SERVICE_NAME = "agent-vm-mcp-resolver";
export const SERVICE_VERSION = "0.1.0";

export const WORKSPACE_ROOT = process.env.AGENT_VM_WORKSPACE || "/workspace";
export const TOOL_CONFIG = process.env.AGENT_VM_TOOL_CONFIG || "/etc/agent-vm/tools.json";
export const PORT = Number.parseInt(process.env.MCP_PORT || "7777", 10);
export const HOST = process.env.MCP_HOST || "127.0.0.1";
export const MAX_WRITE_BYTES = Number.parseInt(process.env.MCP_MAX_WRITE_BYTES || "1000000", 10);
export const MAX_ENTRY_BYTES = Number.parseInt(process.env.MCP_MAX_ENTRY_BYTES || "1000000", 10);
export const CHUNK_SIZE = Number.parseInt(process.env.MCP_CHUNK_SIZE || "500000", 10);
export const EXEC_LOG_DIR = process.env.MCP_EXEC_LOG_DIR || "/tmp/agent-vm/exec-logs";
export const EXEC_LOG_TTL = Number.parseInt(process.env.MCP_EXEC_LOG_TTL || "3600000", 10); // 1 hour
export const EXEC_ENABLE_STREAMING = process.env.MCP_EXEC_ENABLE_STREAMING !== 'false';
export const EXEC_AUDIT_ENABLED = process.env.MCP_EXEC_AUDIT_ENABLED !== 'false';
export const EXEC_AUDIT_LOG = process.env.MCP_EXEC_AUDIT_LOG || "/var/log/agent-vm/shell-audit.log";
export const EXEC_SECURITY_MODE = process.env.MCP_EXEC_SECURITY_MODE || 'strict';

export const ALLOWED_ORIGINS = new Set(
  (process.env.MCP_ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
);

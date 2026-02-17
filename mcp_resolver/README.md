# MCP Resolver

The MCP resolver is an in-container HTTP server that implements the [Model Context Protocol](https://modelcontextprotocol.io/) Streamable HTTP transport. It exposes filesystem and shell tools that let MCP clients interact with the container's workspace.

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/health` | Health check — returns `{"status":"ok"}` |
| `POST` | `/mcp` | MCP requests (initialize, tool calls) |
| `GET` | `/mcp` | SSE stream for real-time notifications |
| `DELETE` | `/mcp` | Terminate a session |

## Connecting

The resolver uses MCP Streamable HTTP with session-based state. A typical session:

```
Client                                    Resolver
  │                                         │
  ├──── POST /mcp (initialize) ───────────>│
  │                                         ├── Create session
  │<──── Response + mcp-session-id header ──┤
  │                                         │
  ├──── GET /mcp (session ID in header) ──>│
  │<──── SSE stream opened ─────────────────┤
  │                                         │
  ├──── POST /mcp (tools/call) ───────────>│
  │<──── SSE events (streaming output) ─────┤
  │<──── Final JSON response ───────────────┤
  │                                         │
  ├──── DELETE /mcp ───────────────────────>│
  │<──── 200 OK ────────────────────────────┤
```

### Initialize a session

```bash
curl -X POST http://localhost:7777/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "method": "initialize",
    "params": {
      "protocolVersion": "1.0",
      "clientInfo": { "name": "my-agent", "version": "1.0" },
      "capabilities": {}
    },
    "id": 1
  }'
```

The response includes an `mcp-session-id` header. Include it in all subsequent requests.

### List available tools

```bash
curl -X POST http://localhost:7777/mcp \
  -H "Content-Type: application/json" \
  -H "mcp-session-id: <SESSION_ID>" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":2}'
```

### Call a tool

```bash
curl -X POST http://localhost:7777/mcp \
  -H "Content-Type: application/json" \
  -H "mcp-session-id: <SESSION_ID>" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "fs.list",
      "arguments": { "path": "." }
    },
    "id": 3
  }'
```

## Tools

### `fs.list`

List files and directories inside the workspace.

**Input:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `path` | string | No | Relative path within workspace (defaults to root) |

**Output:** Array of entries with `name` and `type` (`file`, `dir`, `symlink`, `other`).

```json
{
  "path": "/workspace/src",
  "entries": [
    { "name": "server.js", "type": "file" },
    { "name": "utils", "type": "dir" }
  ]
}
```

---

### `fs.read`

Read a file from the workspace. Large files are automatically chunked with cursor-based pagination.

**Input:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `path` | string | Yes | File path relative to workspace |
| `encoding` | string | No | File encoding (default: `utf8`) |
| `cursor` | string | No | Pagination cursor for large files |

**Output (small files, ≤ 500KB):**

```json
{
  "path": "/workspace/readme.txt",
  "bytes": 1234,
  "encoding": "utf8",
  "content": "file contents here..."
}
```

**Output (large files, > 500KB):**

```json
{
  "path": "/workspace/big-file.log",
  "bytes": 2500000,
  "encoding": "utf8",
  "content": "first 500KB of content...",
  "chunkOffset": 0,
  "chunkSize": 500000,
  "hasMore": true,
  "nextCursor": "eyJ0eXBlIjoiZmlsZSIs..."
}
```

To read the next chunk, call `fs.read` again with the `cursor` value from `nextCursor`. Repeat until `hasMore` is `false`.

---

### `fs.write`

Write content to a file in the workspace. Parent directories are created automatically.

**Input:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `path` | string | Yes | File path relative to workspace |
| `content` | string | Yes | File content to write |
| `encoding` | string | No | File encoding (default: `utf8`) |
| `create_dirs` | boolean | No | Create parent directories (default: `true`) |

**Output:**

```json
{
  "path": "/workspace/output.txt",
  "bytes": 42,
  "encoding": "utf8"
}
```

**Limits:** Maximum write size is 1MB by default (configurable via `MCP_MAX_WRITE_BYTES`).

---

### `shell.exec`

Execute a command in the workspace. Output streams in real-time via SSE and is also captured to a log file for later retrieval.

**Input:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `command` | string | Yes | Base executable name (e.g., `git`, not `git status`) |
| `args` | string[] | No | Array of arguments |
| `timeout` | number | No | Timeout in milliseconds (default: 30000, max: 300000) |

**Output:**

```json
{
  "command": "git status --short",
  "exitCode": 0,
  "stdout": "M  src/server.js\n",
  "stderr": "",
  "logFile": "/tmp/agent-vm/exec-logs/1234567890-abc123.log",
  "logSize": 24,
  "hasMore": false,
  "streamed": true
}
```

When output exceeds the chunk size, use `fs.read` with the `nextCursor` value to retrieve the rest from the log file.

**Security:** This tool is gated by multiple security layers. See [Security](#security) below.

## Automatic Chunking

The resolver prevents memory exhaustion by automatically chunking large responses:

- **File reads:** Files over 500KB are split into chunks. Each response includes a `nextCursor` for requesting the next chunk. A file hash validates consistency between requests — if the file changes mid-read, the cursor is invalidated.
- **Command output:** STDOUT is captured to a log file in `/tmp/agent-vm/exec-logs/`. The first chunk is returned inline. The rest can be retrieved by calling `fs.read` on the log file path with the provided cursor.

The chunk size defaults to 500KB and can be changed with `MCP_CHUNK_SIZE`.

## Real-Time Streaming

When an SSE stream is open (`GET /mcp`), `shell.exec` output is streamed in real-time as MCP logging messages:

- **stdout** → `level: "info"`
- **stderr** → `level: "warning"`
- **completion** → `level: "info"` or `level: "error"` depending on exit code

Streaming is enabled by default. Disable it with `MCP_EXEC_ENABLE_STREAMING=false`.

## Security

The `shell.exec` tool uses 7 independent security layers:

1. **Configuration** — Tool must be listed in `enabled_tools`
2. **Security mode** — Baseline protections enforced by the active mode
3. **Command whitelist** — Only listed commands are allowed (strict/moderate)
4. **Blocked commands** — Explicitly denied commands (e.g., `rm`, `sudo`, `bash`)
5. **Argument validation** — Shell operators, path traversal, and injection patterns are rejected
6. **Direct execution** — Commands run with `shell: false` (no `/bin/sh` interpretation)
7. **Audit logging** — Every execution attempt is logged with timestamp, session, command, and result

### Security Modes

Set via `MCP_EXEC_SECURITY_MODE`:

| Mode | Arg Validation | Cmd Validation | Restricted Env | Block Dangerous | Whitelist |
|------|---------------|----------------|----------------|-----------------|-----------|
| `strict` | Yes | Yes | Yes | Yes | Yes |
| `moderate` | Yes | Yes | No | Yes | Yes |
| `permissive` | No | No | No | No | No |

### Default Allowed Commands

```
git, npm, node, python, pip, ls, cat, grep, find, head, tail, echo, pwd, whoami, date
```

### Default Blocked Commands

```
rm, sudo, su, chmod, chown, dd, mkfs, fdisk, kill, killall, bash, sh, zsh, exec, eval
```

## Configuration Reference

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `AGENT_VM_WORKSPACE` | `/workspace` | Workspace root for all file operations |
| `AGENT_VM_TOOL_CONFIG` | `/etc/agent-vm/tools.json` | Path to tool configuration file |
| `MCP_PORT` | `7777` | HTTP server port |
| `MCP_HOST` | `127.0.0.1` | Bind address (`0.0.0.0` in container) |
| `MCP_ALLOWED_ORIGINS` | _(empty)_ | Comma-separated allowed CORS origins |
| `MCP_MAX_WRITE_BYTES` | `1000000` | Max file write size (bytes) |
| `MCP_MAX_ENTRY_BYTES` | `1000000` | Max response payload size (bytes) |
| `MCP_CHUNK_SIZE` | `500000` | Chunk size for large file pagination (bytes) |
| `MCP_EXEC_LOG_DIR` | `/tmp/agent-vm/exec-logs` | Directory for command output logs |
| `MCP_EXEC_SECURITY_MODE` | `strict` | Security mode: `strict`, `moderate`, `permissive` |
| `MCP_EXEC_ENABLE_STREAMING` | `true` | Stream shell output via SSE |
| `MCP_EXEC_AUDIT_ENABLED` | `true` | Write audit log for shell executions |
| `MCP_EXEC_AUDIT_LOG` | `/var/log/agent-vm/shell-audit.log` | Audit log file path |

### Tool Configuration File

The tool config file (`/etc/agent-vm/tools.json`) controls tool availability and shell execution policy.

```json
{
  "enabled_tools": ["fs.list", "fs.read", "fs.write", "shell.exec"],
  "shell_exec_config": {
    "allow_all": false,
    "allowed_commands": ["git", "npm", "node", "python"],
    "blocked_commands": ["rm", "sudo", "bash"],
    "max_timeout": 300000,
    "default_timeout": 30000,
    "max_concurrent_executions": 3,
    "max_output_size": 10485760,
    "max_args": 100,
    "max_arg_length": 10000,
    "audit_enabled": true
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `enabled_tools` | string[] | Tools to register on the MCP server |
| `allow_all` | boolean | Skip command whitelist check |
| `allowed_commands` | string[] | Commands permitted in strict/moderate mode |
| `blocked_commands` | string[] | Commands always denied (overrides allow_all) |
| `max_timeout` | number | Maximum allowed timeout in ms |
| `default_timeout` | number | Default timeout when none specified |
| `max_concurrent_executions` | number | Max parallel shell.exec calls |
| `max_output_size` | number | Max output capture size in bytes |
| `max_args` | number | Max number of arguments per command |
| `max_arg_length` | number | Max length of a single argument in chars |
| `audit_enabled` | boolean | Enable audit logging |

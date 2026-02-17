#!/usr/bin/env bash
set -euo pipefail

MCP_LOG_DIR=${MCP_LOG_DIR:-/tmp/agent-vm}

mkdir -p "$MCP_LOG_DIR"

if [ "${AGENT_VM_MCP_DISABLED:-0}" != "1" ]; then
  node /opt/agent-vm/mcp-resolver/src/server.js \
    >>"$MCP_LOG_DIR/mcp-resolver.log" 2>&1 &
fi

exec "$@"

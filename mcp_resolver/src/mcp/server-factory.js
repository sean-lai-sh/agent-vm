import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SERVICE_NAME, SERVICE_VERSION } from "../config/constants.js";
import { loadToolConfig } from "../config/loader.js";
import { registerTools } from "../tools/index.js";

export function createServer() {
  const config = loadToolConfig();
  const server = new McpServer({
    name: SERVICE_NAME,
    version: SERVICE_VERSION
  });

  registerTools(server, config);
  return server;
}

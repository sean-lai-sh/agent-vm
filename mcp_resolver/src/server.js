import http from "node:http";
import { SERVICE_NAME, HOST, PORT, WORKSPACE_ROOT } from "./config/index.js";
import { createServer } from "./mcp/index.js";
import { createRequestHandler } from "./http/index.js";

async function start() {
  // Create HTTP request handler with server factory
  const requestHandler = createRequestHandler(createServer);

  const httpServer = http.createServer(requestHandler);

  httpServer.listen(PORT, HOST, () => {
    process.stdout.write(
      `${SERVICE_NAME} listening on ${HOST}:${PORT} (workspace ${WORKSPACE_ROOT})\n`
    );
  });

  const shutdown = async () => {
    console.log("Shutting down server...");

    // Close all active transports
    const transports = requestHandler.getTransports ? requestHandler.getTransports() : {};
    for (const sessionId in transports) {
      try {
        await transports[sessionId].close();
        delete transports[sessionId];
      } catch (error) {
        console.error(`Error closing transport for session ${sessionId}:`, error);
      }
    }

    httpServer.close(() => {
      process.exit(0);
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

start().catch((error) => {
  process.stderr.write(`${SERVICE_NAME} failed to start: ${error.message}\n`);
  process.exit(1);
});

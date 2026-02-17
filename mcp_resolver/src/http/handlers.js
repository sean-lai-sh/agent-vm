import { randomUUID } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isOriginAllowed } from "../security/cors.js";
import { jsonResponse, parseRequestBody, isInitializeRequest } from "./utils.js";

export function createRequestHandler(createServerFn) {
  // Map to store transports by session ID
  const transports = {};

  // Track last MCP request time for staleness detection
  let lastRequestAt = Date.now();

  const handler = async (req, res) => {
    // Health check endpoint — minimal, MCP-standard
    if (req.method === "GET" && req.url === "/health") {
      return jsonResponse(res, 200, { status: "ok" });
    }

    // Poll endpoint — activity info for external orchestrators
    if (req.method === "GET" && req.url === "/poll") {
      return jsonResponse(res, 200, {
        last_request_at: lastRequestAt,
        idle_seconds: Math.floor((Date.now() - lastRequestAt) / 1000),
        active_sessions: Object.keys(transports).length,
      });
    }

    // MCP endpoints
    if (req.url && req.url.startsWith("/mcp")) {
      // Check CORS
      if (!isOriginAllowed(req.headers.origin)) {
        return jsonResponse(res, 403, { error: "Origin not allowed" });
      }

      // Update activity timestamp on every MCP request
      lastRequestAt = Date.now();

      try {
        const sessionId = req.headers["mcp-session-id"];

        // Handle POST requests
        if (req.method === "POST") {
          const body = await parseRequestBody(req);

          if (sessionId && transports[sessionId]) {
            // Reuse existing transport
            const transport = transports[sessionId];
            await transport.handleRequest(req, res, body);
          } else if (!sessionId && isInitializeRequest(body)) {
            // New initialization request - create new transport and server
            const transport = new StreamableHTTPServerTransport({
              sessionIdGenerator: () => randomUUID(),
              onsessioninitialized: (sid) => {
                console.log(`Session initialized with ID: ${sid}`);
                transports[sid] = transport;
              }
            });

            // Set up onclose handler to clean up transport
            transport.onclose = () => {
              const sid = transport.sessionId;
              if (sid && transports[sid]) {
                console.log(`Transport closed for session ${sid}`);
                delete transports[sid];
              }
            };

            // Create a new server instance and connect the transport
            const server = createServerFn();
            await server.connect(transport);
            await transport.handleRequest(req, res, body);
          } else {
            // Invalid request
            return jsonResponse(res, 400, {
              jsonrpc: "2.0",
              error: {
                code: -32000,
                message: "Bad Request: No valid session ID provided"
              },
              id: null
            });
          }
        }
        // Handle GET requests (for SSE streams)
        else if (req.method === "GET") {
          if (!sessionId || !transports[sessionId]) {
            return jsonResponse(res, 400, { error: "Invalid or missing session ID" });
          }
          const transport = transports[sessionId];
          await transport.handleRequest(req, res);
        }
        // Handle DELETE requests (session termination)
        else if (req.method === "DELETE") {
          if (!sessionId || !transports[sessionId]) {
            return jsonResponse(res, 400, { error: "Invalid or missing session ID" });
          }
          const transport = transports[sessionId];
          await transport.handleRequest(req, res);
        }
        else {
          return jsonResponse(res, 405, { error: "Method not allowed" });
        }
      } catch (error) {
        console.error("Error handling MCP request:", error);
        if (!res.headersSent) {
          jsonResponse(res, 500, {
            jsonrpc: "2.0",
            error: {
              code: -32603,
              message: error.message || "Internal server error"
            },
            id: null
          });
        }
      }
      return;
    }

    jsonResponse(res, 404, { error: "Not found" });
  };

  // Expose transports for cleanup in shutdown
  handler.getTransports = () => transports;

  return handler;
}

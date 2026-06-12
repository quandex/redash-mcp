import type { Server as HttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import type { Express, Request, RequestHandler, Response } from "express";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createRedashMcpServer } from "./index.js";
import { logger } from "./logger.js";

export interface HttpServerConfig {
  host: string;
  port: number;
  path: string;
}

const LOCALHOST_ORIGIN_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function createHttpApp(config: Pick<HttpServerConfig, "host" | "path">): Express {
  const app = createMcpExpressApp({ host: config.host });

  app.use(validateOriginHeader);

  app.post(config.path, async (req, res) => {
    const server = createRedashMcpServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    let closed = false;

    const closeRequestResources = async () => {
      if (closed) {
        return;
      }

      closed = true;

      try {
        await transport.close();
      } catch (error) {
        logger.error(`Failed to close HTTP transport: ${error instanceof Error ? error.message : String(error)}`);
      }

      try {
        await server.close();
      } catch (error) {
        logger.error(`Failed to close HTTP MCP server: ${error instanceof Error ? error.message : String(error)}`);
      }
    };

    res.on("close", () => {
      void closeRequestResources();
    });

    try {
      transport.onerror = (error) => {
        logger.error(`Streamable HTTP transport error: ${error.message}`);
      };

      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      logger.error(`Error handling Streamable HTTP request: ${error instanceof Error ? error.message : String(error)}`);

      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: {
            code: -32603,
            message: "Internal server error",
          },
          id: null,
        });
      }

      void closeRequestResources();
    }
  });

  app.get(config.path, methodNotAllowed);
  app.delete(config.path, methodNotAllowed);

  return app;
}

export async function startHttpServer(config: HttpServerConfig): Promise<HttpServer> {
  const app = createHttpApp(config);

  return new Promise((resolve, reject) => {
    const httpServer = app.listen(config.port, config.host);

    httpServer.once("error", reject);
    httpServer.once("listening", () => {
      httpServer.off("error", reject);
      const address = httpServer.address() as AddressInfo | null;
      const port = address?.port ?? config.port;
      logger.info(`Redash MCP Streamable HTTP server listening on http://${formatHost(config.host)}:${port}${config.path}`);
      resolve(httpServer);
    });
  });
}

const validateOriginHeader: RequestHandler = (req, res, next) => {
  const originHeader = req.headers.origin;

  if (!originHeader) {
    next();
    return;
  }

  try {
    const origin = new URL(originHeader);
    if (LOCALHOST_ORIGIN_HOSTS.has(origin.hostname)) {
      next();
      return;
    }
  } catch {
    // Fall through to the JSON-RPC error below.
  }

  res.status(403).json({
    jsonrpc: "2.0",
    error: {
      code: -32000,
      message: `Invalid Origin header: ${originHeader}`,
    },
    id: null,
  });
};

function methodNotAllowed(_req: Request, res: Response): void {
  res.setHeader("Allow", "POST");
  res.status(405).json({
    jsonrpc: "2.0",
    error: {
      code: -32000,
      message: "Method not allowed.",
    },
    id: null,
  });
}

function formatHost(host: string): string {
  if (host.includes(":") && !host.startsWith("[")) {
    return `[${host}]`;
  }

  return host;
}

import type { Server as HttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import type { Express } from "express";
import { jest } from "@jest/globals";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

type HttpServerModule = typeof import("../httpServer.js");

let createHttpApp: HttpServerModule["createHttpApp"];
let startHttpServer: HttpServerModule["startHttpServer"];

beforeAll(async () => {
  process.env.REDASH_URL = "https://redash.example.com";
  process.env.REDASH_API_KEY = "test-api-key";

  try {
    const httpServerModule = await import("../httpServer.js");
    createHttpApp = httpServerModule.createHttpApp;
    startHttpServer = httpServerModule.startHttpServer;
  } catch (error) {
    throw new Error(`Failed to import HTTP server module: ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
  }
});

describe("HTTP MCP server", () => {
  let httpServer: HttpServer | undefined;
  let consoleErrorSpy: jest.SpiedFunction<typeof console.error>;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(async () => {
    if (httpServer) {
      await closeServer(httpServer);
      httpServer = undefined;
    }

    consoleErrorSpy.mockRestore();
  });

  it("returns 405 for GET and DELETE on the MCP endpoint", async () => {
    const app = createHttpApp({ host: "127.0.0.1", path: "/mcp" });
    const serverInfo = await listen(app);
    httpServer = serverInfo.server;

    const getResponse = await fetch(`${serverInfo.baseUrl}/mcp`);
    expect(getResponse.status).toBe(405);
    expect(getResponse.headers.get("allow")).toBe("POST");

    const deleteResponse = await fetch(`${serverInfo.baseUrl}/mcp`, { method: "DELETE" });
    expect(deleteResponse.status).toBe(405);
    expect(deleteResponse.headers.get("allow")).toBe("POST");
  });

  it("returns 404 for unknown paths", async () => {
    const app = createHttpApp({ host: "127.0.0.1", path: "/mcp" });
    const serverInfo = await listen(app);
    httpServer = serverInfo.server;

    const response = await fetch(`${serverInfo.baseUrl}/not-mcp`);
    expect(response.status).toBe(404);
  });

  it("rejects non-local browser origins", async () => {
    const app = createHttpApp({ host: "127.0.0.1", path: "/mcp" });
    const serverInfo = await listen(app);
    httpServer = serverInfo.server;

    const response = await fetch(`${serverInfo.baseUrl}/mcp`, {
      headers: {
        Origin: "https://example.com",
      },
    });

    expect(response.status).toBe(403);
  });

  it("supports SDK Streamable HTTP client listTools requests", async () => {
    httpServer = await startHttpServer({
      host: "127.0.0.1",
      port: 0,
      path: "/mcp",
    });
    const address = httpServer.address() as AddressInfo;
    const url = new URL(`http://127.0.0.1:${address.port}/mcp`);
    const transport = new StreamableHTTPClientTransport(url);
    const client = new Client({
      name: "redash-mcp-test-client",
      version: "1.0.0",
    });

    try {
      await client.connect(transport);
      expect(transport.sessionId).toBeUndefined();

      const result = await client.listTools();

      expect(result.tools.some((tool) => tool.name === "list_queries")).toBe(true);
    } finally {
      await client.close();
    }
  });
});

async function listen(app: Express): Promise<{ server: HttpServer; baseUrl: string }> {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, "127.0.0.1");

    server.once("error", reject);
    server.once("listening", () => {
      server.off("error", reject);
      const address = server.address() as AddressInfo;
      resolve({
        server,
        baseUrl: `http://127.0.0.1:${address.port}`,
      });
    });
  });
}

async function closeServer(server: HttpServer): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

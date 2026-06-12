import { ConfigError, parseServerConfig } from "../config.js";

describe("parseServerConfig", () => {
  it("uses stdio and localhost HTTP defaults", () => {
    expect(parseServerConfig({ env: {}, argv: [] })).toEqual({
      transport: "stdio",
      http: {
        host: "127.0.0.1",
        port: 3000,
        path: "/mcp",
      },
    });
  });

  it("reads HTTP transport settings from environment variables", () => {
    expect(parseServerConfig({
      env: {
        MCP_TRANSPORT: "streamable-http",
        MCP_HTTP_HOST: "localhost",
        MCP_HTTP_PORT: "3333",
        MCP_HTTP_PATH: "/redash-mcp",
      },
      argv: [],
    })).toEqual({
      transport: "http",
      http: {
        host: "localhost",
        port: 3333,
        path: "/redash-mcp",
      },
    });
  });

  it("lets CLI arguments override environment variables", () => {
    expect(parseServerConfig({
      env: {
        MCP_TRANSPORT: "stdio",
        MCP_HTTP_HOST: "127.0.0.1",
        MCP_HTTP_PORT: "3000",
        MCP_HTTP_PATH: "/mcp",
      },
      argv: [
        "--transport",
        "http",
        "--host=localhost",
        "--port",
        "4444",
        "--path=/custom",
      ],
    })).toEqual({
      transport: "http",
      http: {
        host: "localhost",
        port: 4444,
        path: "/custom",
      },
    });
  });

  it("rejects invalid transports", () => {
    expect(() => parseServerConfig({
      env: { MCP_TRANSPORT: "sse" },
      argv: [],
    })).toThrow(ConfigError);
  });

  it.each(["0", "65536", "-1", "abc", "3000.5"])("rejects invalid ports: %s", (port) => {
    expect(() => parseServerConfig({
      env: { MCP_HTTP_PORT: port },
      argv: [],
    })).toThrow(ConfigError);
  });

  it.each(["mcp", "", "/mcp?x=1", "/mcp#section"])("rejects invalid HTTP paths: %s", (httpPath) => {
    expect(() => parseServerConfig({
      env: { MCP_HTTP_PATH: httpPath },
      argv: [],
    })).toThrow(ConfigError);
  });
});

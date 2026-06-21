export type ServerTransport = "stdio" | "http";

export interface ServerConfig {
  transport: ServerTransport;
  http: {
    host: string;
    port: number;
    path: string;
    allowedOrigins?: string[] | "*";
  };
}

export interface ParseServerConfigOptions {
  env?: NodeJS.ProcessEnv;
  argv?: string[];
}

type CliOptionName = "transport" | "host" | "port" | "path";

const DEFAULT_TRANSPORT = "stdio";
const DEFAULT_HTTP_HOST = "127.0.0.1";
const DEFAULT_HTTP_PORT = "3000";
const DEFAULT_HTTP_PATH = "/mcp";

const CLI_OPTIONS: Record<string, CliOptionName> = {
  "--transport": "transport",
  "--host": "host",
  "--port": "port",
  "--path": "path",
};

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

export function parseServerConfig(options: ParseServerConfigOptions = {}): ServerConfig {
  const env = options.env ?? process.env;
  const argv = options.argv ?? process.argv.slice(2);
  const cli = parseCliArgs(argv);

  const transport = parseTransport(
    cli.transport ?? env.MCP_TRANSPORT ?? DEFAULT_TRANSPORT
  );
  const host = parseHost(cli.host ?? env.MCP_HTTP_HOST ?? DEFAULT_HTTP_HOST);
  const port = parsePort(cli.port ?? env.MCP_HTTP_PORT ?? DEFAULT_HTTP_PORT);
  const httpPath = parseHttpPath(cli.path ?? env.MCP_HTTP_PATH ?? DEFAULT_HTTP_PATH);
  const allowedOrigins = parseAllowedOrigins(env.MCP_ALLOWED_ORIGINS);

  return {
    transport,
    http: {
      host,
      port,
      path: httpPath,
      allowedOrigins,
    },
  };
}

// Origin allowlist for the HTTP transport. Unset preserves the upstream
// localhost-only behavior. "*" disables the check — intended only when the
// server runs behind a trusted authenticating reverse proxy on a private
// network (our case: ClusterIP service behind the sigbit OAuth proxy).
function parseAllowedOrigins(value: string | undefined): string[] | "*" | undefined {
  if (value === undefined) {
    return undefined;
  }

  const trimmed = value.trim();
  if (trimmed === "*") {
    return "*";
  }

  const origins = trimmed
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  return origins.length > 0 ? origins : undefined;
}

function parseCliArgs(argv: string[]): Partial<Record<CliOptionName, string>> {
  const result: Partial<Record<CliOptionName, string>> = {};

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--") {
      break;
    }

    const equalsIndex = arg.indexOf("=");
    const option = equalsIndex === -1 ? arg : arg.slice(0, equalsIndex);
    const inlineValue = equalsIndex === -1 ? undefined : arg.slice(equalsIndex + 1);
    const name = CLI_OPTIONS[option];

    if (!name) {
      throw new ConfigError(`Unknown option: ${arg}`);
    }

    const value = inlineValue ?? argv[i + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new ConfigError(`Missing value for ${option}`);
    }

    result[name] = value;

    if (inlineValue === undefined) {
      i += 1;
    }
  }

  return result;
}

function parseTransport(value: string): ServerTransport {
  const normalized = value.trim().toLowerCase();

  if (normalized === "stdio") {
    return "stdio";
  }

  if (normalized === "http" || normalized === "streamable-http") {
    return "http";
  }

  throw new ConfigError(
    `Invalid MCP_TRANSPORT value "${value}". Expected "stdio", "http", or "streamable-http".`
  );
}

function parseHost(value: string): string {
  const host = value.trim();
  if (!host) {
    throw new ConfigError("MCP_HTTP_HOST must not be empty.");
  }

  return host;
}

function parsePort(value: string): number {
  const trimmed = value.trim();

  if (!/^\d+$/.test(trimmed)) {
    throw new ConfigError(`MCP_HTTP_PORT must be an integer between 1 and 65535. Received "${value}".`);
  }

  const port = Number(trimmed);
  if (port < 1 || port > 65535) {
    throw new ConfigError(`MCP_HTTP_PORT must be between 1 and 65535. Received ${port}.`);
  }

  return port;
}

function parseHttpPath(value: string): string {
  const httpPath = value.trim();

  if (!httpPath.startsWith("/")) {
    throw new ConfigError(`MCP_HTTP_PATH must start with "/". Received "${value}".`);
  }

  if (httpPath.includes("?") || httpPath.includes("#")) {
    throw new ConfigError("MCP_HTTP_PATH must not include query strings or fragments.");
  }

  return httpPath;
}

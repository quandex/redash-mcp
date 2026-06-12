import { ConfigError, parseServerConfig, type ServerConfig } from "./config.js";
import { startHttpServer } from "./httpServer.js";
import { startStdioServer } from "./index.js";

export async function runConfiguredServer(config: ServerConfig = parseServerConfig()): Promise<void> {
  if (config.transport === "stdio") {
    await startStdioServer();
    return;
  }

  await startHttpServer(config.http);
}

export async function runConfiguredServerCli(): Promise<void> {
  try {
    await runConfiguredServer();
  } catch (error) {
    if (error instanceof ConfigError) {
      console.error(`Error: ${error.message}`);
    } else {
      console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    }

    process.exit(1);
  }
}

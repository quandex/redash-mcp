#!/usr/bin/env node

import * as dotenv from 'dotenv';
import { existsSync } from 'fs';
import * as path from 'path';
import { ConfigError, parseServerConfig, type ServerConfig } from './config.js';

// Check if .env file exists in current directory and load it
const envPath = path.join(process.cwd(), '.env');
if (existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

let serverConfig: ServerConfig;
try {
  serverConfig = parseServerConfig();
} catch (error) {
  if (error instanceof ConfigError) {
    console.error(`Error: ${error.message}`);
  } else {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  }

  process.exit(1);
}

// Check required environment variables
const requiredVars = ['REDASH_URL', 'REDASH_API_KEY'];
const missingVars = requiredVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error(`Error: Missing required environment variables: ${missingVars.join(', ')}`);
  console.error('');
  console.error('Please create a .env file in your current directory with the following variables:');
  console.error('');
  console.error('REDASH_URL=https://your-redash-instance.com');
  console.error('REDASH_API_KEY=your_api_key');
  console.error('');
  console.error('Or provide them when running the command:');
  console.error('');
  console.error('REDASH_URL=https://your-redash-instance.com REDASH_API_KEY=your_key npx @suthio/redash-mcp');
  process.exit(1);
}

// Run the MCP server after environment validation, because redashClient is initialized on import.
const { runConfiguredServer } = await import('./startup.js');
await runConfiguredServer(serverConfig);

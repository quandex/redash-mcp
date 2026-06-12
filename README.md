# Redash MCP Server

Model Context Protocol (MCP) server for integrating Redash with AI assistants like Claude.

<a href="https://glama.ai/mcp/servers/j9bl90s3tw">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/j9bl90s3tw/badge" alt="Redash Server MCP server" />
</a>

## Features

- Connect to Redash instances via the Redash API
- List available queries and dashboards as resources
- Execute queries and retrieve results
- Execute saved parameterized queries with typed values and saved defaults
- Create and manage queries (create, update, archive)
- Manage query parameters, dashboard parameters, and widget parameter mappings
- Inspect and update dashboard widget layouts and grid positions
- List data sources for query creation
- Get dashboard details and visualizations
- Update chart visualization options with Redash chart-specific settings

## Prerequisites

- Node.js (v22.13 or later for local development with pnpm)
- pnpm
- Access to a Redash instance
- Redash API key

## Environment Variables

The server requires the following environment variables:

- `REDASH_URL`: Your Redash instance URL (e.g., https://redash.example.com)
- `REDASH_API_KEY`: Your Redash API key

Optional variables:
- `REDASH_TIMEOUT`: Timeout for API requests in milliseconds (default: 30000)
- `REDASH_MAX_RESULTS`: Maximum number of results to return (default: 1000)
- `REDASH_EXTRA_HEADERS`: Extra HTTP headers to include with every Redash request. Accepts either a JSON object string or a semicolon/comma-separated list of `key=value` pairs.
- `REDASH_SOCKS_PROXY`: SOCKS proxy URL for routing requests through a proxy (e.g., `socks5h://localhost:1080`). Use `socks5h://` (with `h`) to delegate DNS resolution to the proxy, which is required for internal hostnames that don't resolve on the local machine.
- `MCP_TRANSPORT`: MCP transport to use. Supported values are `stdio`, `http`, and `streamable-http` (default: `stdio`).
- `MCP_HTTP_HOST`: Host for Streamable HTTP mode (default: `127.0.0.1`).
- `MCP_HTTP_PORT`: Port for Streamable HTTP mode (default: `3000`).
- `MCP_HTTP_PATH`: Streamable HTTP endpoint path (default: `/mcp`).

Examples:

JSON (recommended):
```
REDASH_EXTRA_HEADERS='{"CF-Access-Client-Id":"<client_id>","CF-Access-Client-Secret":"<client_secret>"}'
```

Key/value list:
```
REDASH_EXTRA_HEADERS=CF-Access-Client-Id=<client_id>;CF-Access-Client-Secret=<client_secret>
```

Notes:
- The `Authorization` header is managed by the server (`Key <REDASH_API_KEY>`) and cannot be overridden.
- All extra headers are added to every request made to Redash.

## Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/suthio/redash-mcp.git
   cd redash-mcp
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Create a `.env` file with your Redash configuration:
   ```
   REDASH_URL=https://your-redash-instance.com
   REDASH_API_KEY=your_api_key
   # Optional: Cloudflare Access (or other gateway) headers
   # REDASH_EXTRA_HEADERS='{"CF-Access-Client-Id":"<client_id>","CF-Access-Client-Secret":"<client_secret>"}'
   ```

4. Build the project:
   ```bash
   pnpm run build
   ```

5. Start the server:
   ```bash
   pnpm start
   ```

   The default transport is stdio, which is the mode expected by most desktop MCP clients.

## Usage with Claude for Desktop

To use this MCP server with Claude for Desktop, configure it in your Claude for Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

Add the following configuration (edit paths as needed):

```json
{
  "mcpServers": {
    "redash": {
      "command": "npx",
      "args": [
         "-y",
         "@suthio/redash-mcp"
      ],
      "env": {
        "REDASH_API_KEY": "your-api-key",
        "REDASH_URL": "https://your-redash-instance.com"
      }
    }
  }
}
```

## Streamable HTTP Transport

The server can also run as a stateless Streamable HTTP MCP server. Environment variables configure the HTTP listener:

```bash
REDASH_URL=https://your-redash-instance.com \
REDASH_API_KEY=your_api_key \
MCP_TRANSPORT=http \
pnpm start
```

This starts `POST http://127.0.0.1:3000/mcp` by default. CLI flags override environment variables:

```bash
REDASH_URL=https://your-redash-instance.com \
REDASH_API_KEY=your_api_key \
pnpm start -- --transport http --host 127.0.0.1 --port 3333 --path /mcp
```

HTTP mode is stateless: the server does not issue `Mcp-Session-Id`, does not provide a standalone GET SSE stream, and handles each `POST` with a fresh MCP server instance. `GET /mcp` and `DELETE /mcp` return `405 Method Not Allowed`.

The default bind is localhost-only (`127.0.0.1`) with Host header protection. Browser requests with a non-local `Origin` header are rejected.

## Docker

Container images are published to GitHub Container Registry for both `linux/amd64` and `linux/arm64`.

```bash
docker run --rm -p 3000:3000 \
  -e REDASH_URL=https://your-redash-instance.com \
  -e REDASH_API_KEY=your_api_key \
  ghcr.io/suthio/redash-mcp:latest
```

The container runs Streamable HTTP by default and listens on `0.0.0.0:3000` with the MCP endpoint at `/mcp`.
Published images are signed with keyless cosign.

## Available Tools

### Query Management
- `list-queries`: List all available queries in Redash
- `get-query`: Get details of a specific query 
- `create-query`: Create a new query in Redash
- `update-query`: Update an existing query in Redash
- `get-query-parameters`: Inspect saved query parameter definitions
- `update-query-parameters`: Update saved query parameter definitions
- `archive-query`: Archive (soft-delete) a query
- `list-data-sources`: List all available data sources

### Query Execution
- `execute-query`: Execute a query and return results, with optional `maxAge`
- `execute-parameterized-query`: Execute a saved parameterized query with type-aware value coercion, saved defaults, and optional `maxAge`
- `execute-adhoc-query`: Execute an ad-hoc query without saving it to Redash
- `get-query-results-csv`: Get query results in CSV format (supports optional refresh for latest data)

### Dashboard Management
- `list-dashboards`: List all available dashboards
- `get-dashboard`: Get dashboard details and visualizations 
- `get-dashboard-layout`: Inspect widget positions, sizes, and visibility on a dashboard
- `get-visualization`: Get details of a specific visualization
- `get-dashboard-parameters`: Inspect dashboard parameter values and widget mappings
- `update-dashboard-parameters`: Update dashboard parameter values and order
- `update-dashboard-layout`: Move or resize multiple widgets in one call
- `update-widget-layout`: Move or resize a single widget
- `get-widget-parameter-mappings`: Inspect a widget's parameter mappings
- `update-widget-parameter-mappings`: Update a widget's parameter mappings

### Visualization Management
- `create-visualization`: Create a new visualization for a query
- `update-visualization`: Update an existing visualization
- `update-chart-visualization`: Patch chart-specific options like `globalSeriesType`, `columnMapping`, `seriesOptions`, `legend`, and axis settings
- `delete-visualization`: Delete a visualization

## Development

Run in development mode:
```bash
pnpm run dev
```

## Testing

### Unit Tests

```bash
pnpm test
```

### E2E Tests

```bash
pnpm run e2e:test
```

E2E tests use these default values (can be overridden with environment variables):
- `REDASH_URL`: https://demo.redash.io
- `REDASH_API_KEY`: test_api_key

Override example:
```bash
REDASH_URL=https://your-instance.com REDASH_API_KEY=your_key pnpm run e2e:test
```

### Manual Testing

```bash
pnpm run inspector
```

## Version History

- v1.1.0: Added query management functionality (create, update, archive)
- v1.0.0: Initial release

## License

MIT

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const targetUrl = process.env.OPENCRAB_BROWSER_MCP_URL;

if (!targetUrl) {
  console.error("OPENCRAB_BROWSER_MCP_URL is missing.");
  process.exit(1);
}

const client = new Client({
  name: "opencrab-browser-mcp-stdio-proxy",
  version: "0.1.0",
});

const clientTransport = new StreamableHTTPClientTransport(new URL(targetUrl));
await client.connect(clientTransport);

const server = new Server(
  {
    name: "opencrab-browser-mcp-stdio-proxy",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  const toolsResult = await client.listTools();

  return {
    tools: toolsResult.tools,
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  return client.callTool({
    name: request.params.name,
    arguments:
      request.params.arguments && typeof request.params.arguments === "object"
        ? request.params.arguments
        : {},
  });
});

const stdioTransport = new StdioServerTransport();
await server.connect(stdioTransport);

const shutdown = async () => {
  await server.close().catch(() => undefined);
  await client.close().catch(() => undefined);
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

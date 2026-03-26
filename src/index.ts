import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as z from "zod/v4";

const server = new McpServer({
  name: "mcp-ci",
  version: "0.1.0",
});

server.registerTool("ping", { description: "Check if MCP server is running", inputSchema: z.object({}) }, async () => {
  return { content: [{ type: "text" as const, text: "pong - mcp-ci is running" }] };
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("mcp-ci server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

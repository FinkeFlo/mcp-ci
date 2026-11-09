import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import { loadTenantConfig } from "./core/config.js";
import { buildServer } from "./server.js";

const { server, tenantManager } = buildServer(loadTenantConfig());

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  const readOnly = tenantManager.isActiveReadOnly() ? ", read-only" : "";
  console.error(
    `mcp-ci server running on stdio (tenant: ${tenantManager.getActiveTenantKey()}${readOnly})`
  );
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

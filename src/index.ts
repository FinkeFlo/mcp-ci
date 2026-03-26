import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { TenantManager } from "./core/tenant-manager.js";
import { Auth } from "./core/auth.js";
import { ODataClient } from "./core/odata-client.js";
import { tenantModule } from "./modules/tenant/tools.js";
import type { TenantConfig, ModuleContext, Module } from "./core/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadTenantConfig(): TenantConfig {
  const configPath = resolve(__dirname, "../config/tenants.json");
  const raw = readFileSync(configPath, "utf-8");
  return JSON.parse(raw) as TenantConfig;
}

const config = loadTenantConfig();
const tenantManager = new TenantManager(config);
const auth = new Auth();
const odataClient = new ODataClient(auth, tenantManager);

const server = new McpServer({ name: "mcp-ci", version: "0.1.0" });
const context: ModuleContext = { tenantManager, odataClient };
const modules: Module[] = [tenantModule];

for (const mod of modules) {
  mod.register(server, context);
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(
    `mcp-ci server running on stdio (tenant: ${tenantManager.getActiveTenantKey()})`
  );
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

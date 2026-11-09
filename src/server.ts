import { McpServer } from "@modelcontextprotocol/server";
import { TenantManager } from "./core/tenant-manager.js";
import { Auth } from "./core/auth.js";
import { ODataClient } from "./core/odata-client.js";
import { ToolAccess } from "./core/tool-access.js";
import { createGuardedServer } from "./core/guarded-server.js";
import { allModules } from "./modules/all.js";
import type { ModuleContext, TenantConfig } from "./core/types.js";

/** Builds the MCP server with every module registered through the read-only guard. */
export function buildServer(config: TenantConfig): { server: McpServer; tenantManager: TenantManager } {
  const tenantManager = new TenantManager(config);
  const odataClient = new ODataClient(new Auth(), tenantManager);

  const server = new McpServer({ name: "mcp-ci", version: "0.1.0" });
  const guardedServer = createGuardedServer(server, new ToolAccess(tenantManager));
  const context: ModuleContext = { tenantManager, odataClient };

  for (const mod of allModules) {
    mod.register(guardedServer, context);
  }
  return { server, tenantManager };
}

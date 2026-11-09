import { McpServer } from "@modelcontextprotocol/server";
import { TenantManager } from "./core/tenant-manager.js";
import { Auth } from "./core/auth.js";
import { ODataClient } from "./core/odata-client.js";
import { ToolAccess } from "./core/tool-access.js";
import { createGuardedServer } from "./core/guarded-server.js";
import { validateTenantConfig } from "./core/config.js";
import { allModules } from "./modules/all.js";
import { SERVER_VERSION } from "./version.js";
import { LOCAL_PRINCIPAL, type Principal, type TokenProvider } from "./core/extension-points.js";
import type { ModuleContext, TenantConfig } from "./core/types.js";

/**
 * Builds the MCP server with every module registered through the read-only
 * guard. `odataClient` replaces the HTTP client, for evals against mock data.
 * It also replaces ODataClient's write guard, so it must never be a client
 * that can reach a tenant. `tokenProvider` replaces the OAuth client
 * credentials default; `principal` is who the server belongs to.
 */
export function buildServer(
  config: TenantConfig,
  options: { odataClient?: ODataClient; tokenProvider?: TokenProvider; principal?: Principal } = {}
): { server: McpServer; tenantManager: TenantManager; odataClient: ODataClient } {
  const tenantManager = new TenantManager(validateTenantConfig(config, "server config"));
  const odataClient =
    options.odataClient ?? new ODataClient(options.tokenProvider ?? new Auth(), tenantManager);

  const server = new McpServer({ name: "mcp-ci", version: SERVER_VERSION });
  const guardedServer = createGuardedServer(server, new ToolAccess(tenantManager));
  const context: ModuleContext = {
    tenantManager,
    odataClient,
    principal: options.principal ?? LOCAL_PRINCIPAL,
  };

  for (const mod of allModules) {
    mod.register(guardedServer, context);
  }
  return { server, tenantManager, odataClient };
}

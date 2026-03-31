import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { TenantManager } from "./tenant-manager.js";
import type { ODataClient } from "./odata-client.js";

export interface Tenant {
  name: string;
  apiUrl: string;
  oauthUrl: string;
  clientId: string;
  clientSecret: string;
}

export interface TenantConfig {
  tenants: Record<string, Tenant>;
  defaultTenant: string;
}

export interface Module {
  name: string;
  register(server: McpServer, context: ModuleContext): void;
}

export interface ModuleContext {
  tenantManager: TenantManager;
  odataClient: ODataClient;
}

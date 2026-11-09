import type { McpServer } from "@modelcontextprotocol/server";
import type { TenantManager } from "./tenant-manager.js";
import type { ODataClient } from "./odata-client.js";

export interface Tenant {
  name: string;
  apiUrl: string;
  oauthUrl: string;
  clientId: string;
  clientSecret: string;
  settings?: TenantSettings;
}

export interface TenantSettings {
  /**
   * Unless exactly false, no request other than GET may reach this tenant.
   * A missing value counts as read-only.
   */
  readOnly?: boolean;
  allowPayloads?: boolean;
  denyTools?: string[];
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

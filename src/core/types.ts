import type { TenantManager } from "./tenant-manager.js";

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
  register(server: any, context: ModuleContext): void;
}

export interface ModuleContext {
  tenantManager: TenantManager;
}

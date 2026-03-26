import type { Tenant, TenantConfig } from "./types.js";

export class TenantManager {
  private config: TenantConfig;
  private activeTenantKey: string;

  constructor(config: TenantConfig) {
    if (!config.tenants[config.defaultTenant]) {
      throw new Error(
        `Default tenant '${config.defaultTenant}' not found in config`
      );
    }
    this.config = config;
    this.activeTenantKey = config.defaultTenant;
  }

  getActiveTenant(): Tenant {
    return this.config.tenants[this.activeTenantKey];
  }

  getActiveTenantKey(): string {
    return this.activeTenantKey;
  }

  setActiveTenant(key: string): void {
    if (!this.config.tenants[key]) {
      throw new Error(
        `Unknown tenant: ${key}. Available: ${this.listTenants().join(", ")}`
      );
    }
    this.activeTenantKey = key;
  }

  listTenants(): string[] {
    return Object.keys(this.config.tenants);
  }
}

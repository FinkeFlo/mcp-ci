import type { Tenant, TenantConfig } from "./types.js";

export class TenantManager {
  private config: TenantConfig;
  private activeTenantKey: string;
  private listeners: Array<(tenant: Tenant, key: string) => void> = [];

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
    const tenant = this.getActiveTenant();
    for (const listener of this.listeners) listener(tenant, key);
  }

  isActiveReadOnly(): boolean {
    // Fail closed: only an explicit false makes the tenant writable.
    return this.getActiveTenant().settings?.readOnly !== false;
  }

  /** Called after every successful `setActiveTenant`. */
  onActiveTenantChange(listener: (tenant: Tenant, key: string) => void): void {
    this.listeners.push(listener);
  }

  listTenants(): string[] {
    return Object.keys(this.config.tenants);
  }
}

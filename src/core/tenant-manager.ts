import { AsyncLocalStorage } from "node:async_hooks";
import type { Tenant, TenantConfig } from "./types.js";

export class TenantManager {
  private config: TenantConfig;
  private activeTenantKey: string;
  private listeners: Array<(tenant: Tenant, key: string) => void> = [];
  // Tenant a running tool call was checked against; wins over activeTenantKey.
  private pinned = new AsyncLocalStorage<string>();

  constructor(config: TenantConfig) {
    if (!Object.hasOwn(config.tenants, config.defaultTenant)) {
      throw new Error(
        `Default tenant '${config.defaultTenant}' not found in config`
      );
    }
    this.config = config;
    this.activeTenantKey = config.defaultTenant;
  }

  getActiveTenant(): Tenant {
    return this.config.tenants[this.getActiveTenantKey()];
  }

  getActiveTenantKey(): string {
    return this.pinned.getStore() ?? this.activeTenantKey;
  }

  /**
   * Runs `fn` with the current tenant pinned: everything inside, including
   * awaited work, sees this tenant even if `setActiveTenant` runs meanwhile.
   */
  runPinned<T>(fn: () => T): T {
    return this.pinned.run(this.getActiveTenantKey(), fn);
  }

  setActiveTenant(key: string): void {
    if (!Object.hasOwn(this.config.tenants, key)) {
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

  isActivePayloadAllowed(): boolean {
    // Fail closed: only an explicit true exposes payload tools.
    return this.getActiveTenant().settings?.allowPayloads === true;
  }

  isToolDenied(name: string): boolean {
    return this.getActiveTenant().settings?.denyTools?.includes(name) ?? false;
  }

  /**
   * The active tenant's allow-list, or `undefined` when it has none. A value
   * that is not a list counts as an empty list (fail closed).
   */
  getAllowTools(): string[] | undefined {
    const allowTools: unknown = this.getActiveTenant().settings?.allowTools;
    if (allowTools === undefined) return undefined;
    return Array.isArray(allowTools) ? allowTools.filter((entry) => typeof entry === "string") : [];
  }

  /** Called after every successful `setActiveTenant`. */
  onActiveTenantChange(listener: (tenant: Tenant, key: string) => void): void {
    this.listeners.push(listener);
  }

  listTenants(): string[] {
    return Object.keys(this.config.tenants);
  }
}

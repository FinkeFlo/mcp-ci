import { describe, it, expect, beforeEach } from "vitest";
import { TenantManager } from "../tenant-manager.js";
import type { TenantConfig } from "../types.js";

const testConfig: TenantConfig = {
  tenants: {
    dev: {
      name: "DEV",
      apiUrl: "https://dev.example.com",
      oauthUrl: "https://dev.example.com/oauth/token",
      clientId: "dev-id",
      clientSecret: "dev-secret",
      settings: { readOnly: false },
    },
    qas: {
      name: "QAS",
      apiUrl: "https://qas.example.com",
      oauthUrl: "https://qas.example.com/oauth/token",
      clientId: "qas-id",
      clientSecret: "qas-secret",
      settings: { readOnly: false },
    },
  },
  defaultTenant: "dev",
};

describe("TenantManager", () => {
  let manager: TenantManager;
  beforeEach(() => {
    manager = new TenantManager(testConfig);
  });

  it("sets default tenant on creation", () => {
    expect(manager.getActiveTenant().name).toBe("DEV");
  });

  it("returns active tenant key", () => {
    expect(manager.getActiveTenantKey()).toBe("dev");
  });

  it("lists all available tenants", () => {
    expect(manager.listTenants()).toEqual(["dev", "qas"]);
  });

  it("switches to a valid tenant", () => {
    manager.setActiveTenant("qas");
    expect(manager.getActiveTenant().name).toBe("QAS");
    expect(manager.getActiveTenantKey()).toBe("qas");
  });

  it("throws on invalid tenant key", () => {
    expect(() => manager.setActiveTenant("prd")).toThrow("Unknown tenant: prd");
  });

  it("isActiveReadOnly reflects the active tenant", () => {
    const config: TenantConfig = {
      ...testConfig,
      tenants: { ...testConfig.tenants, prod: { ...testConfig.tenants.qas, settings: { readOnly: true } } },
    };
    const m = new TenantManager(config);
    expect(m.isActiveReadOnly()).toBe(false);
    m.setActiveTenant("prod");
    expect(m.isActiveReadOnly()).toBe(true);
    m.setActiveTenant("qas");
    expect(m.isActiveReadOnly()).toBe(false);
  });

  it("a tenant without settings counts as read-only", () => {
    const m = new TenantManager({
      tenants: { bare: { ...testConfig.tenants.dev, settings: undefined } },
      defaultTenant: "bare",
    });
    expect(m.isActiveReadOnly()).toBe(true);
  });

  it("listener fires after a successful switch with the new tenant", () => {
    const calls: Array<[string, string]> = [];
    manager.onActiveTenantChange((tenant, key) => calls.push([tenant.name, key]));
    manager.setActiveTenant("qas");
    expect(calls).toEqual([["QAS", "qas"]]);
  });

  it("listener does not fire when the key is unknown", () => {
    const calls: string[] = [];
    manager.onActiveTenantChange((_tenant, key) => calls.push(key));
    expect(() => manager.setActiveTenant("prd")).toThrow("Unknown tenant: prd");
    expect(calls).toEqual([]);
  });

  it("throws on invalid default tenant", () => {
    expect(
      () => new TenantManager({ ...testConfig, defaultTenant: "prd" })
    ).toThrow("Default tenant 'prd' not found");
  });
});

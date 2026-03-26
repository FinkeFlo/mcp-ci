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
    },
    qas: {
      name: "QAS",
      apiUrl: "https://qas.example.com",
      oauthUrl: "https://qas.example.com/oauth/token",
      clientId: "qas-id",
      clientSecret: "qas-secret",
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

  it("throws on invalid default tenant", () => {
    expect(
      () => new TenantManager({ ...testConfig, defaultTenant: "prd" })
    ).toThrow("Default tenant 'prd' not found");
  });
});

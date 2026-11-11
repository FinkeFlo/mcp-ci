import { describe, it, expect } from "vitest";
import { validateTenantConfig, parseTenantConfig, NoTenantsError } from "../config.js";

const connection = {
  apiUrl: "https://x.example.com",
  oauthUrl: "https://x.example.com/oauth/token",
  clientId: "id",
  clientSecret: "super-secret-value",
};

function config(settings: unknown, extra: Record<string, unknown> = {}): unknown {
  return {
    tenants: { a: { name: "A", ...connection, ...(settings === undefined ? {} : { settings }), ...extra } },
    defaultTenant: "a",
  };
}

describe("validateTenantConfig", () => {
  it.each([["false"], [0], ["no"], [null], [undefined]])(
    "keeps a tenant read-only when readOnly is %j",
    (readOnly) => {
      expect(validateTenantConfig(config({ readOnly })).tenants.a.settings?.readOnly).toBe(true);
    }
  );

  it("only an explicit false makes a tenant writable", () => {
    expect(validateTenantConfig(config({ readOnly: false })).tenants.a.settings?.readOnly).toBe(false);
  });

  it.each([["true"], [1], [undefined]])("keeps payloads off when allowPayloads is %j", (allowPayloads) => {
    expect(validateTenantConfig(config({ allowPayloads })).tenants.a.settings?.allowPayloads).toBe(false);
  });

  it("rejects a denyTools value that is not a list", () => {
    expect(() => validateTenantConfig(config({ denyTools: "create_package" }))).toThrow(
      "'denyTools' must be a list of tool names"
    );
  });

  it("rejects an unknown tool name in denyTools", () => {
    expect(() => validateTenantConfig(config({ denyTools: ["no_such_tool"] }))).toThrow(
      "unknown tool 'no_such_tool' in denyTools"
    );
  });

  it("rejects an unknown or misspelled setting", () => {
    expect(() => validateTenantConfig(config({ readonly: false }))).toThrow("unknown setting 'readonly'");
  });

  it("rejects zero tenants with NoTenantsError", () => {
    expect(() => validateTenantConfig({ tenants: {}, defaultTenant: "a" })).toThrow(NoTenantsError);
  });

  it.each([["missing"], ["toString"], [undefined], [3]])("rejects default tenant %j", (defaultTenant) => {
    expect(() =>
      validateTenantConfig({ tenants: { a: { ...connection } }, defaultTenant })
    ).toThrow("default tenant");
  });

  it("rejects a tenant that is not an object and anything that is not a config", () => {
    expect(() => validateTenantConfig({ tenants: { a: "x" }, defaultTenant: "a" })).toThrow();
    expect(() => validateTenantConfig(undefined)).toThrow();
    expect(() => validateTenantConfig({ tenants: [], defaultTenant: "a" })).toThrow();
  });

  it("rejects the tenant key __proto__", () => {
    const parsed = JSON.parse(
      `{"tenants":{"__proto__":${JSON.stringify(connection)},"a":${JSON.stringify(connection)}},"defaultTenant":"a"}`
    );
    expect(() => validateTenantConfig(parsed)).toThrow("__proto__");
  });

  it("returns a deep copy that later changes to the input cannot reach", () => {
    const input = config({ readOnly: false, denyTools: ["delete_package"] }) as any;
    const result = validateTenantConfig(input);
    expect(result).not.toBe(input);
    expect(result.tenants.a).not.toBe(input.tenants.a);
    input.tenants.a.settings.readOnly = true;
    input.tenants.a.settings.denyTools.push("create_package");
    expect(result.tenants.a.settings?.readOnly).toBe(false);
    expect(result.tenants.a.settings?.denyTools).toEqual(["delete_package"]);
  });

  it("passes an auth block through as a copy and rejects a non-object", () => {
    const auth = { method: "custom", ref: "r1" };
    const result = validateTenantConfig(config(undefined, { auth }));
    expect(result.tenants.a.auth).toEqual(auth);
    expect(result.tenants.a.auth).not.toBe(auth);
    expect(() => validateTenantConfig(config(undefined, { auth: "x" }))).toThrow(
      "'auth' must be an object"
    );
  });

  it("leaves auth undefined when the tenant has none", () => {
    expect(validateTenantConfig(config(undefined)).tenants.a.auth).toBeUndefined();
  });

  it("never puts the client secret into an error message", () => {
    const missing = { tenants: { a: { ...connection, apiUrl: "" } }, defaultTenant: "a" };
    const unknownTool = config({ denyTools: ["no_such_tool"] });
    for (const bad of [missing, unknownTool]) {
      try {
        validateTenantConfig(bad);
        expect.unreachable();
      } catch (error) {
        expect((error as Error).message).not.toContain("super-secret-value");
      }
    }
  });
});

describe("validateTenantConfig and enabled", () => {
  const entry = (extra: Record<string, unknown>) => ({ name: "X", ...connection, ...extra });

  it.each([[false], ["true"], [1], [null]])("drops a tenant whose enabled is %j", (enabled) => {
    const result = validateTenantConfig({
      tenants: { off: entry({ enabled }), on: entry({ enabled: true }) },
      defaultTenant: "on",
    });
    expect(Object.keys(result.tenants)).toEqual(["on"]);
  });

  it("keeps a tenant without an enabled key, since the source already chose", () => {
    expect(Object.keys(validateTenantConfig({ tenants: { a: entry({}) }, defaultTenant: "a" }).tenants)).toEqual(["a"]);
  });

  it("fails when the only or default tenant is disabled", () => {
    expect(() => validateTenantConfig({ tenants: { a: entry({ enabled: false }) }, defaultTenant: "a" })).toThrow(NoTenantsError);
    expect(() =>
      validateTenantConfig({ tenants: { a: entry({ enabled: false }), b: entry({}) }, defaultTenant: "a" })
    ).toThrow("default tenant 'a'");
  });
});

describe("allowTools outside settings", () => {
  it.each([["allowTools"], ["allowtools"], ["AllowTools"], ["ALLOWTOOLS"]])(
    "rejects a tenant-level %s instead of ignoring it",
    (key) => {
      expect(() =>
        validateTenantConfig({ tenants: { a: { name: "A", ...connection, [key]: ["read"] } }, defaultTenant: "a" })
      ).toThrow(`'${key}' must be under 'settings'`);
    }
  );

  it("rejects it in a file config too", () => {
    const text = `{ "tenants": { "a": { "enabled": true, "apiUrl": "https://x", "oauthUrl": "https://x/t", "clientId": "i", "clientSecret": "s", "allowTools": [] } }, "defaultTenant": "a" }`;
    expect(() => parseTenantConfig(text)).toThrow("'allowTools' must be under 'settings'");
  });
});

describe("parseTenantConfig without an enabled tenant", () => {
  it("throws NoTenantsError with the existing message", () => {
    const text = `{ "tenants": { "a": { "enabled": false } }, "defaultTenant": "a" }`;
    expect(() => parseTenantConfig(text)).toThrow(NoTenantsError);
    expect(() => parseTenantConfig(text)).toThrow('no enabled tenant. A tenant is only active with "enabled": true');
  });
});

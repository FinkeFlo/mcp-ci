import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { parseTenantConfig, resolveConfigPath } from "../config.js";

const connection = `
  "apiUrl": "https://x.example.com/path",
  "oauthUrl": "https://x.example.com/oauth/token",
  "clientId": "id",
  "clientSecret": "super-secret-value"`;

function config(tenantBody: string, defaultTenant = "prod"): string {
  return `{ "tenants": { "prod": { "name": "PROD", ${tenantBody} } }, "defaultTenant": "${defaultTenant}" }`;
}

describe("parseTenantConfig", () => {
  it("parses comments and trailing commas", () => {
    const text = `{
      // line comment
      "tenants": {
        /* block comment */
        "prod": { "name": "PROD", "enabled": true, ${connection}, },
      },
      "defaultTenant": "prod",
    }`;
    expect(Object.keys(parseTenantConfig(text).tenants)).toEqual(["prod"]);
  });

  it("keeps // inside strings", () => {
    const parsed = parseTenantConfig(config(`"enabled": true, ${connection}`));
    expect(parsed.tenants.prod.apiUrl).toBe("https://x.example.com/path");
  });

  it("only enabled === true is loaded", () => {
    const cases: Array<[string, boolean]> = [
      [`"enabled": true,`, true],
      [`"enabled": false,`, false],
      [`"enabled": "true",`, false],
      [`"enabled": 1,`, false],
      [`"enabled": null,`, false],
      [``, false],
      [`"enable": true,`, false],
    ];
    for (const [flag, loaded] of cases) {
      const text = `{ "tenants": {
        "on": { "name": "ON", "enabled": true, ${connection} },
        "x": { "name": "X", ${flag} ${connection} }
      }, "defaultTenant": "on" }`;
      const keys = Object.keys(parseTenantConfig(text).tenants);
      expect(keys.includes("x"), `flag: ${flag || "(missing)"}`).toBe(loaded);
    }
  });

  it("disabled entries are not validated", () => {
    const text = `{ "tenants": {
      "on": { "name": "ON", "enabled": true, ${connection} },
      "stub": {},
      "half": { "enabled": false, "settings": { "readOnly": "yes", "bogus": 1 } }
    }, "defaultTenant": "on" }`;
    expect(Object.keys(parseTenantConfig(text).tenants)).toEqual(["on"]);
  });

  it("only readOnly === false makes a tenant writable", () => {
    const cases: Array<[string, boolean]> = [
      [`"settings": { "readOnly": false },`, false],
      [`"settings": { "readOnly": true },`, true],
      [`"settings": { "readOnly": "false" },`, true],
      [`"settings": { "readOnly": 0 },`, true],
      [`"settings": { "readOnly": null },`, true],
      [`"settings": {},`, true],
      [``, true],
    ];
    for (const [settings, readOnly] of cases) {
      const parsed = parseTenantConfig(config(`"enabled": true, ${settings} ${connection}`));
      expect(parsed.tenants.prod.settings, `settings: ${settings || "(missing)"}`).toEqual({ readOnly });
    }
  });

  it("rejects a non-object settings value", () => {
    expect(() =>
      parseTenantConfig(config(`"enabled": true, "settings": true, ${connection}`))
    ).toThrow(/prod.*settings/);
  });

  it("rejects unknown settings keys", () => {
    expect(() =>
      parseTenantConfig(config(`"enabled": true, "settings": { "readonly": true }, ${connection}`))
    ).toThrow(/readonly/);
  });

  it("requires connection fields on enabled tenants", () => {
    const text = config(`"enabled": true,
      "oauthUrl": "https://x.example.com/oauth/token",
      "clientId": "id",
      "clientSecret": "super-secret-value"`);
    let message = "";
    try {
      parseTenantConfig(text);
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toMatch(/prod/);
    expect(message).toMatch(/apiUrl/);
    expect(message).not.toMatch(/super-secret-value/);
  });

  it("name is optional and defaults to the tenant key", () => {
    const text = `{ "tenants": { "prod": { "enabled": true, ${connection} } }, "defaultTenant": "prod" }`;
    expect(parseTenantConfig(text).tenants.prod.name).toBe("prod");
  });

  it("default tenant must be enabled", () => {
    const text = `{ "tenants": {
      "on": { "name": "ON", "enabled": true, ${connection} },
      "off": { "name": "OFF", "enabled": false, ${connection} }
    }, "defaultTenant": "off" }`;
    expect(() => parseTenantConfig(text)).toThrow(/off.*enabled/);
  });

  it("needs at least one enabled tenant", () => {
    expect(() => parseTenantConfig(config(connection))).toThrow(/"enabled": true/);
  });

  it("reports syntax errors with line and column", () => {
    const text = `{\n  "tenants": {\n    "prod": { "name" "PROD" }\n  }\n}`;
    expect(() => parseTenantConfig(text, "tenants.jsonc")).toThrow(/tenants\.jsonc.*line 3, column \d+/);
  });

  it("rejects a document that is not an object", () => {
    expect(() => parseTenantConfig("[]")).toThrow(/tenants/);
  });
});

describe("resolveConfigPath", () => {
  const base = "/repo";
  const jsonc = resolve(base, "config/tenants.jsonc");
  const json = resolve(base, "config/tenants.json");

  it("uses MCP_CI_CONFIG when set", () => {
    const result = resolveConfigPath({ MCP_CI_CONFIG: "/elsewhere/agent.jsonc" }, base, () => true);
    expect(result).toEqual({ path: "/elsewhere/agent.jsonc", legacy: false });
  });

  it("prefers tenants.jsonc", () => {
    expect(resolveConfigPath({}, base, (p) => p === jsonc || p === json)).toEqual({ path: jsonc, legacy: false });
  });

  it("falls back to tenants.json as legacy", () => {
    expect(resolveConfigPath({}, base, (p) => p === json)).toEqual({ path: json, legacy: true });
  });

  it("throws listing the paths checked", () => {
    expect(() => resolveConfigPath({}, base, () => false)).toThrow(/tenants\.jsonc.*tenants\.json/s);
  });
});

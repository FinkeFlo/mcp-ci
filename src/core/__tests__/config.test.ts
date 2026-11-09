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
      expect(parsed.tenants.prod.settings, `settings: ${settings || "(missing)"}`).toEqual({ readOnly, allowPayloads: false, denyTools: [] });
    }
  });

  it("allowPayloads is fail closed: only true allows payloads", () => {
    const cases: Array<[string, boolean]> = [
      [`"settings": { "allowPayloads": true },`, true],
      [`"settings": { "allowPayloads": false },`, false],
      [`"settings": { "allowPayloads": "true" },`, false],
      [`"settings": { "allowPayloads": 1 },`, false],
      [`"settings": {},`, false],
      ["", false],
    ];
    for (const [settings, allowPayloads] of cases) {
      const parsed = parseTenantConfig(config(`"enabled": true, ${settings} ${connection}`));
      expect(parsed.tenants.prod.settings?.allowPayloads, `settings: ${settings || "(missing)"}`).toBe(allowPayloads);
    }
  });

  it("rejects a default tenant that only exists on Object.prototype", () => {
    for (const name of ["constructor", "toString", "__proto__"]) {
      expect(() => parseTenantConfig(config(`"enabled": true, ${connection}`, name)), name).toThrow(/default tenant/);
    }
  });

  it("denyTools keeps known tool names", () => {
    const parsed = parseTenantConfig(config(`"enabled": true, "settings": { "denyTools": ["get_package", "list_messages"] }, ${connection}`));
    expect(parsed.tenants.prod.settings?.denyTools).toEqual(["get_package", "list_messages"]);
  });

  it("denyTools rejects unknown names and non-string lists", () => {
    expect(() =>
      parseTenantConfig(config(`"enabled": true, "settings": { "denyTools": ["get_pakage"] }, ${connection}`))
    ).toThrow(/prod.*unknown tool 'get_pakage'/);
    expect(() =>
      parseTenantConfig(config(`"enabled": true, "settings": { "denyTools": ["constructor"] }, ${connection}`))
    ).toThrow(/unknown tool 'constructor'/);
    for (const value of [`"get_package"`, `[1]`, `{}`, `null`]) {
      expect(() =>
        parseTenantConfig(config(`"enabled": true, "settings": { "denyTools": ${value} }, ${connection}`)), value
      ).toThrow(/denyTools.*list of tool names/);
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
    expect(resolveConfigPath({ MCP_CI_CONFIG: "/elsewhere/agent.jsonc" }, base, () => true)).toBe("/elsewhere/agent.jsonc");
  });

  it("uses tenants.jsonc", () => {
    expect(resolveConfigPath({}, base, (p) => p === jsonc || p === json)).toBe(jsonc);
  });

  it("ignores a leftover tenants.json", () => {
    expect(() => resolveConfigPath({}, base, (p) => p === json)).toThrow(/No tenant config found.*tenants\.jsonc/);
    expect(() => resolveConfigPath({}, base, (p) => p === json)).not.toThrow(/tenants\.json[^c]/);
  });

  it("falls back to the user config, also under XDG_CONFIG_HOME", () => {
    const user = resolve("/home/me/.config/mcp-ci/tenants.jsonc");
    expect(resolveConfigPath({}, base, (p) => p === user, "/home/me")).toBe(user);
    const xdg = resolve("/xdg/mcp-ci/tenants.jsonc");
    expect(resolveConfigPath({ XDG_CONFIG_HOME: "/xdg" }, base, (p) => p === xdg, "/home/me")).toBe(xdg);
  });

  it("prefers the repository config over the user config", () => {
    expect(resolveConfigPath({}, base, () => true, "/home/me")).toBe(jsonc);
  });

  it("throws naming every path checked", () => {
    expect(() => resolveConfigPath({}, base, () => false, "/home/me")).toThrow(
      `No tenant config found. Checked: ${jsonc}, ${resolve("/home/me/.config/mcp-ci/tenants.jsonc")}`
    );
  });
});

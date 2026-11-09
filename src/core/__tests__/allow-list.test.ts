import { describe, it, expect, vi, afterEach } from "vitest";
import { buildServer } from "../../server.js";
import { validateTenantConfig } from "../config.js";
import { TenantManager } from "../tenant-manager.js";
import { ToolAccess, classifyTool } from "../tool-access.js";
import { TOOL_CLASSES } from "../tool-classes.js";
import { connectClient } from "../../__tests__/helpers/mcp-client.js";
import type { TenantSettings } from "../types.js";

const connection = {
  apiUrl: "https://t.example.com",
  oauthUrl: "https://t.example.com/oauth/token",
  clientId: "id",
  clientSecret: "secret",
};
const tenantTools = ["get_tenant", "set_tenant"];
const toolsOfClass = (...classes: string[]) =>
  Object.keys(TOOL_CLASSES).filter((name) => classes.includes(TOOL_CLASSES[name]));

function configWith(settings: unknown) {
  return {
    tenants: { t: { name: "T", ...connection, settings } },
    defaultTenant: "t",
  } as never;
}

async function listed(settings: TenantSettings): Promise<string[]> {
  const { server } = buildServer(configWith(settings), { tokenProvider: { getToken: async () => "t" } });
  const client = await connectClient(server);
  const names = await client.toolNames();
  await client.close();
  return names.sort();
}

afterEach(() => vi.restoreAllMocks());

describe("allowTools", () => {
  it("lists exactly what readOnly and allowPayloads allow when the setting is missing", async () => {
    expect(await listed({ readOnly: true })).toEqual(toolsOfClass("read").sort());
    expect(await listed({ readOnly: false, allowPayloads: true })).toEqual(Object.keys(TOOL_CLASSES).sort());
  });

  it("lists only the tenant tools for an empty list, and refuses every other call without a request", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    expect(await listed({ readOnly: false, allowPayloads: true, allowTools: [] })).toEqual(tenantTools);
    const { server } = buildServer(configWith({ readOnly: false, allowTools: [] }), {
      tokenProvider: { getToken: async () => "t" },
    });
    const client = await connectClient(server);
    expect((await client.callTool("get_package", { id: "x" })).failed).toBe(true);
    expect((await client.callTool("get_tenant")).failed).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
    await client.close();
  });

  it("accepts class names and tool names together", async () => {
    expect(await listed({ readOnly: false, allowTools: ["read"] })).toEqual(toolsOfClass("read").sort());
    expect(await listed({ readOnly: false, allowTools: ["get_package"] })).toEqual(["get_package", ...tenantTools].sort());
    expect(await listed({ readOnly: false, allowTools: ["read", "create_package"] })).toEqual(
      [...toolsOfClass("read"), "create_package"].sort()
    );
    expect(await listed({ readOnly: false, allowPayloads: true, allowTools: ["payload"] })).toEqual(
      [...toolsOfClass("payload"), ...tenantTools].sort()
    );
  });

  it("lets denyTools win over the allow-list", async () => {
    const names = await listed({ readOnly: false, allowTools: ["read"], denyTools: ["get_package"] });
    expect(names).not.toContain("get_package");
    expect(names).toContain("list_packages");
    const { server } = buildServer(configWith({ readOnly: false, allowTools: ["get_package"], denyTools: ["get_package"] }), {
      tokenProvider: { getToken: async () => "t" },
    });
    const client = await connectClient(server);
    expect((await client.callTool("get_package", { id: "x" })).failed).toBe(true);
    await client.close();
  });

  it("never widens what readOnly and allowPayloads forbid", async () => {
    expect(await listed({ readOnly: true, allowTools: ["write"] })).toEqual(tenantTools);
    expect(await listed({ readOnly: true, allowTools: ["create_package", "delete_package"] })).toEqual(tenantTools);
    expect(await listed({ readOnly: false, allowPayloads: false, allowTools: ["payload"] })).toEqual(tenantTools);
    expect(await listed({ readOnly: false, allowPayloads: false, allowTools: ["download_log_file"] })).toEqual(tenantTools);
  });

  it("follows a tenant switch inside one session", async () => {
    const { server } = buildServer(
      {
        tenants: {
          open: { name: "OPEN", ...connection, settings: { readOnly: false } },
          narrow: { name: "NARROW", ...connection, settings: { readOnly: true, allowTools: ["write", "get_package"] } },
        },
        defaultTenant: "open",
      },
      { tokenProvider: { getToken: async () => "t" } }
    );
    const client = await connectClient(server);
    expect(await client.toolNames()).toContain("create_package");
    await client.callTool("set_tenant", { tenant: "narrow" });
    expect((await client.toolNames()).sort()).toEqual(["get_package", ...tenantTools].sort());
    await client.close();
  });
});

describe("allowTools validation", () => {
  it.each([
    ["an unknown tool", ["get_pakage"], "unknown tool 'get_pakage' in allowTools"],
    ["a wrong-case class", ["Read"], "unknown tool 'Read' in allowTools"],
    ["a string", "read", "'allowTools' must be a list of tool or class names"],
    ["a number", 5, "'allowTools' must be a list of tool or class names"],
    ["null", null, "'allowTools' must be a list of tool or class names"],
    ["an object", {}, "'allowTools' must be a list of tool or class names"],
    ["a list with a number", [1], "'allowTools' must be a list of tool or class names"],
  ])("rejects %s", (_name, allowTools, message) => {
    expect(() => validateTenantConfig(configWith({ allowTools }))).toThrow(message);
  });

  it("rejects a misspelled setting key instead of leaving the tenant unrestricted", () => {
    expect(() => validateTenantConfig(configWith({ allowtools: [] }))).toThrow("unknown setting 'allowtools'");
  });

  it("keeps an empty list empty, copies it, and omits it when missing", () => {
    const input = { allowTools: [] as string[] };
    const result = validateTenantConfig(configWith(input));
    expect(result.tenants.t.settings?.allowTools).toEqual([]);
    expect(result.tenants.t.settings?.allowTools).not.toBe(input.allowTools);
    expect(Object.hasOwn(validateTenantConfig(configWith({})).tenants.t.settings!, "allowTools")).toBe(false);
  });
});

describe("allowTools at runtime without validation", () => {
  it("treats a wrong type as an empty list", () => {
    const manager = new TenantManager({
      tenants: { t: { name: "T", ...connection, settings: { readOnly: false, allowTools: "read" as never } } },
      defaultTenant: "t",
    });
    const access = new ToolAccess(manager);
    expect(manager.getAllowTools()).toEqual([]);
    expect(access.isAllowed("get_package")).toBe(false);
    expect(access.isAllowed("get_tenant")).toBe(true);
    expect(access.isAllowed("set_tenant")).toBe(true);
  });

  it("reports undefined only when the setting is absent", () => {
    const manager = new TenantManager({
      tenants: { t: { name: "T", ...connection, settings: { readOnly: false } } },
      defaultTenant: "t",
    });
    expect(manager.getAllowTools()).toBeUndefined();
    expect(classifyTool("get_package")).toBe("read");
  });
});

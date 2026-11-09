import { describe, it, expect, vi } from "vitest";
import * as z from "zod/v4";
import { McpServer } from "@modelcontextprotocol/server";
import { TenantManager } from "../tenant-manager.js";
import { ToolAccess } from "../tool-access.js";
import { createGuardedServer } from "../guarded-server.js";
import type { TenantConfig } from "../types.js";

const connection = {
  apiUrl: "https://x.example.com",
  oauthUrl: "https://x.example.com/oauth/token",
  clientId: "id",
  clientSecret: "secret",
};

const config: TenantConfig = {
  tenants: {
    prod: { name: "PROD", ...connection, settings: { readOnly: true } },
    dev: { name: "DEV", ...connection, settings: { readOnly: false } },
  },
  defaultTenant: "prod",
};

function fakeServer() {
  const handles = new Map<string, { enable: ReturnType<typeof vi.fn>; disable: ReturnType<typeof vi.fn> }>();
  const server = {
    registerTool: vi.fn((name: string) => {
      const handle = { enable: vi.fn(), disable: vi.fn() };
      handles.set(name, handle);
      return handle;
    }),
  };
  return { server: server as unknown as McpServer, handles };
}

function setup() {
  const tenantManager = new TenantManager(config);
  const access = new ToolAccess(tenantManager);
  const { server, handles } = fakeServer();
  const guarded = createGuardedServer(server, access);
  for (const name of ["get_package", "create_package", "frobnicate_x"]) {
    guarded.registerTool(name, {}, async () => ({ content: [] }));
  }
  return { tenantManager, handles };
}

describe("ToolAccess with a guarded server", () => {
  it("write tools are disabled when the default tenant is read-only", () => {
    const { handles } = setup();
    expect(handles.get("create_package")!.disable).toHaveBeenCalled();
  });

  it("read tools stay enabled", () => {
    const { handles } = setup();
    expect(handles.get("get_package")!.disable).not.toHaveBeenCalled();
  });

  it("unknown prefix is disabled on read-only", () => {
    const { handles } = setup();
    expect(handles.get("frobnicate_x")!.disable).toHaveBeenCalled();
  });

  it("switch read-only -> writable enables write tools, and back disables them again", () => {
    const { tenantManager, handles } = setup();
    const create = handles.get("create_package")!;
    create.disable.mockClear();

    tenantManager.setActiveTenant("dev");
    expect(create.enable).toHaveBeenCalledTimes(1);
    expect(create.disable).not.toHaveBeenCalled();

    tenantManager.setActiveTenant("prod");
    expect(create.disable).toHaveBeenCalledTimes(1);
    expect(handles.get("get_package")!.disable).not.toHaveBeenCalled();
  });

  it("the registerTool return value is passed through", () => {
    const tenantManager = new TenantManager(config);
    const { server, handles } = fakeServer();
    const guarded = createGuardedServer(server, new ToolAccess(tenantManager));
    const returned = guarded.registerTool("get_x", {}, async () => ({ content: [] }));
    expect(returned).toBe(handles.get("get_x"));
  });

  it("works with the real McpServer handle", () => {
    const tenantManager = new TenantManager(config);
    const guarded = createGuardedServer(
      new McpServer({ name: "test", version: "0.0.0" }),
      new ToolAccess(tenantManager)
    );
    const create = guarded.registerTool(
      "create_package",
      { description: "x", inputSchema: z.object({}) },
      async () => ({ content: [] })
    );
    const get = guarded.registerTool(
      "get_package",
      { description: "x", inputSchema: z.object({}) },
      async () => ({ content: [] })
    );
    expect(create.enabled).toBe(false);
    expect(get.enabled).toBe(true);
    tenantManager.setActiveTenant("dev");
    expect(create.enabled).toBe(true);
  });
});

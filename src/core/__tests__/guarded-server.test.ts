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
    support: { name: "SUPPORT", ...connection, settings: { readOnly: true, allowPayloads: true } },
    locked: { name: "LOCKED", ...connection, settings: { readOnly: false, denyTools: ["get_package", "create_package"] } },
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
  const calls: string[] = [];
  for (const name of ["get_package", "create_package", "frobnicate_x", "get_trace"]) {
    guarded.registerTool(name, {}, async () => {
      calls.push(name);
      return { content: [] };
    });
  }
  // The callback the real server would invoke is the guarded wrapper.
  const invoke = (name: string) => {
    const call = (server.registerTool as unknown as ReturnType<typeof vi.fn>).mock.calls.find(([n]) => n === name)!;
    return (call[2] as () => Promise<{ content: unknown[]; isError?: boolean }>)();
  };
  return { tenantManager, handles, calls, invoke };
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

  it("payload tools are hidden unless the tenant allows payloads, independent of readOnly", () => {
    const { tenantManager, handles } = setup();
    const trace = handles.get("get_trace")!;
    expect(trace.disable).toHaveBeenCalled();
    trace.disable.mockClear();

    tenantManager.setActiveTenant("dev");
    expect(trace.disable).toHaveBeenCalledTimes(1);
    expect(trace.enable).not.toHaveBeenCalled();

    const create = handles.get("create_package")!;
    create.enable.mockClear();
    tenantManager.setActiveTenant("support");
    expect(trace.enable).toHaveBeenCalledTimes(1);
    // support is read-only: payloads yes, writes still no.
    expect(create.disable).toHaveBeenCalled();
    expect(create.enable).not.toHaveBeenCalled();
  });

  it("blocks a hidden tool at call time without running its handler", async () => {
    const { tenantManager, calls, invoke } = setup();
    for (const name of ["get_trace", "create_package", "frobnicate_x"]) {
      const result = await invoke(name);
      expect(result.isError, name).toBe(true);
      expect(JSON.stringify(result.content)).toContain("not allowed on tenant 'prod'");
    }
    expect(calls).toEqual([]);

    await invoke("get_package");
    tenantManager.setActiveTenant("support");
    await invoke("get_trace");
    expect(calls).toEqual(["get_package", "get_trace"]);
  });

  it("a restricted call keeps the tenant it was checked against, even if set_tenant runs meanwhile", async () => {
    const tenantManager = new TenantManager({ ...config, defaultTenant: "support" });
    const { server } = fakeServer();
    const guarded = createGuardedServer(server, new ToolAccess(tenantManager));
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const seen: string[] = [];
    guarded.registerTool("get_trace", {}, async () => {
      await gate;
      seen.push(tenantManager.getActiveTenantKey(), String(tenantManager.isActivePayloadAllowed()));
      return { content: [] };
    });
    const handler = (server.registerTool as unknown as ReturnType<typeof vi.fn>).mock.calls[0][2] as () => Promise<unknown>;
    const call = handler();
    tenantManager.setActiveTenant("prod");
    release();
    await call;
    expect(seen).toEqual(["support", "true"]);
    expect(tenantManager.getActiveTenantKey()).toBe("prod");
  });

  it("refuses to register a tool whose handler cannot be wrapped", () => {
    const { server } = fakeServer();
    const guarded = createGuardedServer(server, new ToolAccess(new TenantManager(config)));
    expect(() => guarded.registerTool("get_trace", {} as never, {} as never)).toThrow(/get_trace.*handler/);
    // Read tools too: denyTools can restrict them.
    expect(() => guarded.registerTool("get_package", {} as never, {} as never)).toThrow(/get_package.*handler/);
  });

  it("denyTools hides and refuses the listed tools, read or write, only on that tenant", async () => {
    const { tenantManager, handles, calls, invoke } = setup();
    tenantManager.setActiveTenant("dev");
    handles.get("get_package")!.disable.mockClear();
    tenantManager.setActiveTenant("locked");
    expect(handles.get("get_package")!.disable).toHaveBeenCalled();
    expect(handles.get("create_package")!.disable).toHaveBeenCalled();
    for (const name of ["get_package", "create_package"]) {
      expect((await invoke(name)).isError, name).toBe(true);
    }
    expect(calls).toEqual([]);

    tenantManager.setActiveTenant("dev");
    expect(handles.get("get_package")!.enable).toHaveBeenCalled();
    await invoke("get_package");
    expect(calls).toEqual(["get_package"]);
  });

  it("only toggles a real handle when its state changes", () => {
    const tenantManager = new TenantManager(config);
    const access = new ToolAccess(tenantManager);
    const handle = { enabled: true, enable: vi.fn(), disable: vi.fn(() => (handle.enabled = false)) };
    access.track("create_package", handle);
    expect(handle.disable).toHaveBeenCalledTimes(1);
    access.apply();
    expect(handle.disable).toHaveBeenCalledTimes(1);
    expect(handle.enable).not.toHaveBeenCalled();
  });

  it("does not re-enable a real handle that is already enabled", () => {
    const access = new ToolAccess(new TenantManager({ ...config, defaultTenant: "dev" }));
    const handle = { enabled: true, enable: vi.fn(), disable: vi.fn() };
    access.track("create_package", handle);
    access.apply();
    expect(handle.enable).not.toHaveBeenCalled();
    expect(handle.disable).not.toHaveBeenCalled();
  });

  it("a read call stays on the tenant it was checked against, so denyTools elsewhere cannot be bypassed", async () => {
    const tenantManager = new TenantManager({ ...config, defaultTenant: "dev" });
    const { server } = fakeServer();
    const guarded = createGuardedServer(server, new ToolAccess(tenantManager));
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const seen: string[] = [];
    guarded.registerTool("get_package", {}, async () => {
      await gate;
      seen.push(tenantManager.getActiveTenantKey());
      return { content: [] };
    });
    const handler = (server.registerTool as unknown as ReturnType<typeof vi.fn>).mock.calls[0][2] as () => Promise<unknown>;
    const call = handler();
    tenantManager.setActiveTenant("locked");
    release();
    await call;
    expect(seen).toEqual(["dev"]);
  });

  it("set_tenant is not pinned, so it really switches the tenant", async () => {
    const tenantManager = new TenantManager(config);
    const { server } = fakeServer();
    const access = new ToolAccess(tenantManager);
    const guarded = createGuardedServer(server, access);
    guarded.registerTool("set_tenant", {}, async () => {
      tenantManager.setActiveTenant("dev");
      return { content: [] };
    });
    const create = { enabled: false, enable: vi.fn(() => (create.enabled = true)), disable: vi.fn() };
    access.track("create_package", create);
    const handler = (server.registerTool as unknown as ReturnType<typeof vi.fn>).mock.calls[0][2] as () => Promise<unknown>;
    await handler();
    expect(tenantManager.getActiveTenantKey()).toBe("dev");
    expect(create.enable).toHaveBeenCalled();
  });

  it("set_tenant listed in denyTools is refused and leaves the tenant unchanged", async () => {
    const tenantManager = new TenantManager({
      tenants: { ...config.tenants, pinned: { name: "PINNED", ...connection, settings: { denyTools: ["set_tenant"] } } },
      defaultTenant: "pinned",
    });
    const { server } = fakeServer();
    const guarded = createGuardedServer(server, new ToolAccess(tenantManager));
    guarded.registerTool("set_tenant", {}, async () => {
      tenantManager.setActiveTenant("dev");
      return { content: [] };
    });
    const handler = (server.registerTool as unknown as ReturnType<typeof vi.fn>).mock.calls[0][2] as () => Promise<{ isError?: boolean }>;
    expect((await handler()).isError).toBe(true);
    expect(tenantManager.getActiveTenantKey()).toBe("pinned");
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

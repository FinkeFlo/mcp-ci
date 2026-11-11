import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { configKey, createSessionFactory } from "../session-factory.js";
import { NoTenantsError } from "../config.js";
import { classifyTool } from "../tool-access.js";
import { connectClient } from "../../__tests__/helpers/mcp-client.js";
import type { ConfigSource, Principal, TokenProvider } from "../extension-points.js";
import type { Tenant, TenantConfig, TenantSettings } from "../types.js";

const person = (subject: string): Principal => ({ subject, roles: [], claims: {} });
const alice = person("alice");
const bob = person("bob");

function tenant(host: string, settings: TenantSettings = {}): Tenant {
  return {
    name: host.toUpperCase(),
    apiUrl: `https://${host}.example.com`,
    oauthUrl: `https://${host}.example.com/oauth/token`,
    clientId: `id-${host}`,
    clientSecret: "secret",
    settings,
  };
}

const sourceOf = (configs: Record<string, unknown>): ConfigSource => ({
  resolve: vi.fn(async (principal: Principal) => configs[principal.subject] as TenantConfig),
});

function tokenProvider(): TokenProvider & { getToken: ReturnType<typeof vi.fn> } {
  return { getToken: vi.fn(async () => "token") };
}

/** Every request answers 200 with an empty body and a CSRF header. */
function mockFetch() {
  return vi.spyOn(globalThis, "fetch").mockImplementation(
    async () =>
      ({
        ok: true,
        status: 200,
        headers: new Headers({ "X-CSRF-Token": "csrf" }),
        text: async () => "",
        json: async () => ({ d: { results: [] } }),
      }) as unknown as Response
  );
}
const urlsOf = (spy: { mock: { calls: unknown[][] } }) => spy.mock.calls.map((call) => String(call[0]));

describe("session factory", () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it("keeps the active tenant, tool list and guards of two sessions independent", async () => {
    const factory = createSessionFactory({
      configSource: sourceOf({
        alice: { tenants: { a_rw: tenant("a-rw", { readOnly: false }), a_ro: tenant("a-ro", { readOnly: true }) }, defaultTenant: "a_ro" },
        bob: { tenants: { b_ro: tenant("b-ro", { readOnly: true }) }, defaultTenant: "b_ro" },
      }),
      tokenProvider: tokenProvider(),
    });
    const a = await connectClient((await factory.createSession(alice)).server);
    const b = await connectClient((await factory.createSession(bob)).server);
    const bobToolsBefore = await b.toolNames();
    expect(await a.toolNames()).not.toContain("create_package");

    expect((await a.callTool("set_tenant", { tenant: "a_rw" })).failed).toBe(false);

    expect(await a.toolNames()).toContain("create_package");
    expect(await b.toolNames()).toEqual(bobToolsBefore);
    expect((await b.callTool("get_tenant")).text).toContain("Active tenant: b_ro");
    const crossover = await b.callTool("set_tenant", { tenant: "a_rw" });
    expect(crossover.failed).toBe(true);
    expect(crossover.text).toContain("Unknown tenant");
    expect((await b.callTool("get_tenant")).text).toContain("Active tenant: b_ro");
    expect((await b.callTool("get_tenant")).text).not.toContain("a_rw");
    await a.close();
    await b.close();
  });

  it("does not let one session's switch change another session that uses the same tenant keys", async () => {
    const shared: TenantConfig = {
      tenants: { rw: tenant("rw", { readOnly: false }), ro: tenant("ro", { readOnly: true }) },
      defaultTenant: "rw",
    };
    const factory = createSessionFactory({
      configSource: sourceOf({ alice: shared, bob: shared }),
      tokenProvider: tokenProvider(),
    });
    const a = await factory.createSession(alice);
    const b = await factory.createSession(bob);
    const clientB = await connectClient(b.server);
    const before = await clientB.toolNames();
    a.tenantManager.setActiveTenant("ro");
    expect(b.tenantManager.getActiveTenantKey()).toBe("rw");
    expect(b.tenantManager.isActiveReadOnly()).toBe(false);
    expect(await clientB.toolNames()).toEqual(before);
    await clientB.close();
    await a.server.close();
  });

  it("finishes a write on the tenant it started on while another session switches", async () => {
    const fetchSpy = mockFetch();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const slow: TokenProvider = { getToken: vi.fn(async () => (await gate, "token")) };
    const config: TenantConfig = {
      tenants: { rw: tenant("rw", { readOnly: false }), ro: tenant("ro", { readOnly: true }) },
      defaultTenant: "rw",
    };
    const factory = createSessionFactory({ configSource: sourceOf({ alice: config, bob: config }), tokenProvider: slow });
    const a = await connectClient((await factory.createSession(alice)).server);
    const b = await connectClient((await factory.createSession(bob)).server);

    const running = a.callTool("create_package", { id: "P", name: "P", confirm: true });
    await vi.waitFor(() => expect(slow.getToken).toHaveBeenCalled());
    expect((await b.callTool("set_tenant", { tenant: "ro" })).failed).toBe(false);
    release();
    const result = await running;

    expect(result.failed).toBe(false);
    expect(urlsOf(fetchSpy).length).toBeGreaterThan(0);
    for (const url of urlsOf(fetchSpy)) expect(url).toMatch(/^https:\/\/rw\.example\.com\//);
    await a.close();
    await b.close();
  });

  it("keeps a read-only session read-only while another session switches to a writable tenant", async () => {
    const fetchSpy = mockFetch();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const slow: TokenProvider = { getToken: vi.fn(async () => (await gate, "token")) };
    const factory = createSessionFactory({
      configSource: sourceOf({
        alice: { tenants: { ro: tenant("ro", { readOnly: true }) }, defaultTenant: "ro" },
        bob: { tenants: { ro: tenant("ro", { readOnly: true }), rw: tenant("rw", { readOnly: false }) }, defaultTenant: "ro" },
      }),
      tokenProvider: slow,
    });
    const aSession = await factory.createSession(alice);
    const a = await connectClient(aSession.server);
    const b = await connectClient((await factory.createSession(bob)).server);

    const reading = a.callTool("list_packages");
    await vi.waitFor(() => expect(slow.getToken).toHaveBeenCalled());
    expect((await b.callTool("set_tenant", { tenant: "rw" })).failed).toBe(false);
    release();
    await reading;

    expect(aSession.tenantManager.getActiveTenantKey()).toBe("ro");
    fetchSpy.mockClear();
    const write = await a.callTool("create_package", { id: "P", name: "P", confirm: true });
    expect(write.failed).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
    await a.close();
    await b.close();
  });

  it("gives every session its own validated copy of a config the source keeps handing out", async () => {
    mockFetch();
    const shared: TenantConfig = { tenants: { t: tenant("t", { readOnly: true }) }, defaultTenant: "t" };
    const factory = createSessionFactory({
      configSource: sourceOf({ alice: shared, bob: shared }),
      tokenProvider: tokenProvider(),
    });
    const a = await factory.createSession(alice);
    const b = await factory.createSession(bob);
    expect(a.tenantManager.getActiveTenant()).not.toBe(b.tenantManager.getActiveTenant());
    expect(a.tenantManager.getActiveTenant()).not.toBe(shared.tenants.t);

    shared.tenants.t.settings!.readOnly = false;

    expect(a.tenantManager.isActiveReadOnly()).toBe(true);
    await expect(a.odataClient.post("/api/v1/X", {})).rejects.toThrow("read-only");
    const client = await connectClient(a.server);
    expect((await client.toolNames()).filter((name) => classifyTool(name) !== "read")).toEqual([]);
    await client.close();
    await b.server.close();
  });

  describe("on a read-only tenant without payloads, every layer refuses", () => {
    const readOnly: TenantConfig = { tenants: { ro: tenant("ro", { readOnly: true, allowPayloads: false }) }, defaultTenant: "ro" };

    it("hides write and payload tools", async () => {
      const factory = createSessionFactory({ configSource: sourceOf({ alice: readOnly }), tokenProvider: tokenProvider() });
      const client = await connectClient((await factory.createSession(alice)).server);
      const names = await client.toolNames();
      expect(names).toContain("get_package");
      expect(names.filter((name) => classifyTool(name) !== "read")).toEqual([]);
      await client.close();
    });

    it("refuses write and payload calls without any request", async () => {
      const fetchSpy = mockFetch();
      const provider = tokenProvider();
      const factory = createSessionFactory({ configSource: sourceOf({ alice: readOnly }), tokenProvider: provider });
      const client = await connectClient((await factory.createSession(alice)).server);
      expect((await client.callTool("create_package", { id: "P", name: "P", confirm: true })).failed).toBe(true);
      expect((await client.callTool("download_log_file", { name: "x" })).failed).toBe(true);
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(provider.getToken).not.toHaveBeenCalled();
      await client.close();
    });

    it("refuses post, put and delete at the HTTP client even when called directly", async () => {
      const fetchSpy = mockFetch();
      const provider = tokenProvider();
      const factory = createSessionFactory({ configSource: sourceOf({ alice: readOnly }), tokenProvider: provider });
      const session = await factory.createSession(alice);
      await expect(session.odataClient.post("/api/v1/X", {})).rejects.toThrow("read-only");
      await expect(session.odataClient.put("/api/v1/X", {})).rejects.toThrow("read-only");
      await expect(session.odataClient.delete("/api/v1/X")).rejects.toThrow("read-only");
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(provider.getToken).not.toHaveBeenCalled();
      await session.server.close();
    });
  });

  it("hands the principal to the config source and to the token provider of its own session", async () => {
    mockFetch();
    const provider = tokenProvider();
    const config: TenantConfig = { tenants: { rw: tenant("rw", { readOnly: false }) }, defaultTenant: "rw" };
    const source = sourceOf({ alice: config, bob: config });
    const factory = createSessionFactory({ configSource: source, tokenProvider: provider });
    const sessionA = await factory.createSession(alice);
    const sessionB = await factory.createSession(bob);
    expect(source.resolve).toHaveBeenNthCalledWith(1, alice);
    expect(source.resolve).toHaveBeenNthCalledWith(2, bob);
    expect(sessionA.principal).toBe(alice);

    await sessionA.odataClient.getValue("/api/v1/X");
    await sessionB.odataClient.getValue("/api/v1/X");
    expect(provider.getToken.mock.calls.map((call) => call[1])).toEqual([alice, bob]);
    await sessionA.server.close();
    await sessionB.server.close();
  });

  it("shares one CSRF cache across sessions for the same tenant and person only", async () => {
    const fetchSpy = mockFetch();
    const config: TenantConfig = { tenants: { rw: tenant("rw", { readOnly: false }) }, defaultTenant: "rw" };
    const factory = createSessionFactory({
      configSource: sourceOf({ alice: config, bob: config }),
      tokenProvider: tokenProvider(),
    });
    const first = await factory.createSession(alice);
    const second = await factory.createSession(alice);
    const other = await factory.createSession(bob);
    for (const session of [first, second, other]) await session.odataClient.post("/api/v1/X", {});
    const csrfFetches = fetchSpy.mock.calls.filter(
      (call) => ((call[1] as RequestInit).headers as Record<string, string>)["X-CSRF-Token"] === "Fetch"
    );
    expect(csrfFetches).toHaveLength(2);
    for (const session of [first, second, other]) await session.server.close();
  });

  describe("a config source cannot skip the safety rules", () => {
    const create = (config: unknown) =>
      createSessionFactory({ configSource: sourceOf({ alice: config }), tokenProvider: tokenProvider() }).createSession(alice);

    it("rejects denyTools that is not a list", async () => {
      await expect(
        create({ tenants: { t: { ...tenant("t"), settings: { denyTools: "create_package" } } }, defaultTenant: "t" })
      ).rejects.toThrow("'denyTools' must be a list");
    });

    it("rejects an unknown tool name", async () => {
      await expect(
        create({ tenants: { t: { ...tenant("t"), settings: { denyTools: ["no_such_tool"] } } }, defaultTenant: "t" })
      ).rejects.toThrow("unknown tool 'no_such_tool'");
    });

    it("fails closed on a string readOnly", async () => {
      const session = await create({
        tenants: { t: { ...tenant("t"), settings: { readOnly: "false" } } },
        defaultTenant: "t",
      });
      expect(session.tenantManager.isActiveReadOnly()).toBe(true);
      await session.server.close();
    });

    it("rejects zero tenants with NoTenantsError", async () => {
      await expect(create({ tenants: {}, defaultTenant: "t" })).rejects.toThrow(NoTenantsError);
    });

    it("passes an error from the config source on unchanged", async () => {
      const factory = createSessionFactory({
        configSource: { resolve: async () => { throw new Error("backend down"); } },
        tokenProvider: tokenProvider(),
      });
      await expect(factory.createSession(alice)).rejects.toThrow("backend down");
    });
  });
});

describe("configKey", () => {
  const config: TenantConfig = { tenants: { a: tenant("a", { readOnly: true }) }, defaultTenant: "a" };

  it("ignores key order and undefined fields", () => {
    const reordered = { defaultTenant: "a", tenants: { a: { ...tenant("a", { readOnly: true }), extra: undefined } } };
    expect(configKey(reordered as TenantConfig)).toBe(configKey(config));
  });

  it("changes with any setting", () => {
    const writable: TenantConfig = { tenants: { a: tenant("a", { readOnly: false }) }, defaultTenant: "a" };
    expect(configKey(writable)).not.toBe(configKey(config));
  });

  it("does not contain the client secret", () => {
    expect(configKey(config)).not.toContain("secret");
  });
});

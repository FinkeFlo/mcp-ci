import { describe, it, expect, vi, afterEach } from "vitest";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/server";
import { startHttpServer, type RunningHttpServer, type HttpServerOptions } from "../server.js";
import type { Authenticator, ConfigSource, Principal } from "../../core/extension-points.js";
import type { Tenant, TenantConfig, TenantSettings } from "../../core/types.js";

const person = (subject: string, extra: Partial<Principal> = {}): Principal => ({
  subject,
  roles: [],
  claims: { marker: `claim-marker-${subject}` },
  ...extra,
});
const principals: Record<string, Principal> = {
  "token-alice": person("alice"),
  "token-bob": person("bob"),
  "token-zero": person("zero"),
  "token-broken": person("broken"),
};

function tenant(host: string, settings: TenantSettings): Tenant {
  return {
    name: host.toUpperCase(),
    apiUrl: `https://${host}.example.com`,
    oauthUrl: `https://${host}.example.com/oauth/token`,
    clientId: `id-${host}`,
    clientSecret: "secret",
    settings,
  };
}

const configs: Record<string, unknown> = {
  alice: {
    tenants: { a_rw: tenant("a-rw", { readOnly: false }), a_ro: tenant("a-ro", { readOnly: true }) },
    defaultTenant: "a_rw",
  } satisfies TenantConfig,
  bob: { tenants: { b_ro: tenant("b-ro", { readOnly: true }) }, defaultTenant: "b_ro" } satisfies TenantConfig,
  zero: { tenants: {}, defaultTenant: "x" },
  broken: {
    tenants: { t: { ...tenant("t", {}), settings: { denyTools: ["no_such_tool"] } } },
    defaultTenant: "t",
  },
};

const bearerAuthenticator = (): Authenticator & { authenticate: ReturnType<typeof vi.fn> } => ({
  authenticate: vi.fn(async (request: Request) => {
    const header = request.headers.get("authorization");
    const found = header?.startsWith("Bearer ") ? principals[header.slice(7)] : undefined;
    if (!found) throw new Error("bad token detail-xyz");
    return found;
  }),
});

const configSource = (): ConfigSource & { resolve: ReturnType<typeof vi.fn> } => ({
  resolve: vi.fn(async (principal: Principal) => configs[principal.subject] as TenantConfig),
});

const running: RunningHttpServer[] = [];
async function start(overrides: Partial<HttpServerOptions> = {}) {
  const authenticator = bearerAuthenticator();
  const source = configSource();
  const server = await startHttpServer({
    configSource: source,
    authenticator,
    tokenProvider: { getToken: async () => "token" },
    port: 0,
    ...overrides,
  });
  running.push(server);
  return { server, authenticator, source };
}
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(running.splice(0).map((server) => server.close()));
});

interface Reply {
  status: number;
  headers: Headers;
  text: string;
  message?: any;
}

function parse(text: string): any {
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) return JSON.parse(trimmed);
  const datas = trimmed
    .split("\n")
    .filter((line) => line.startsWith("data:") && line.slice(5).trim() !== "")
    .map((line) => JSON.parse(line.slice(5)));
  return datas.at(-1);
}

async function call(
  url: string,
  token: string | undefined,
  options: { method?: string; body?: unknown; sessionId?: string; rawBody?: string } = {}
): Promise<Reply> {
  const method = options.method ?? "POST";
  const headers: Record<string, string> = { Accept: "application/json, text/event-stream" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.sessionId) headers["Mcp-Session-Id"] = options.sessionId;
  const hasBody = options.body !== undefined || options.rawBody !== undefined;
  if (hasBody) headers["Content-Type"] = "application/json";
  const response = await fetch(url, {
    method,
    headers,
    body: hasBody ? (options.rawBody ?? JSON.stringify(options.body)) : undefined,
  });
  const text = await response.text();
  let message: any;
  try {
    message = text ? parse(text) : undefined;
  } catch {
    message = undefined;
  }
  return { status: response.status, headers: response.headers, text, message };
}

const initializeBody = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "0" } },
};

async function open(url: string, token: string): Promise<{ sessionId: string; reply: Reply }> {
  const reply = await call(url, token, { body: initializeBody });
  const sessionId = reply.headers.get("mcp-session-id") ?? "";
  if (reply.status === 200) {
    await call(url, token, { body: { jsonrpc: "2.0", method: "notifications/initialized" }, sessionId });
  }
  return { sessionId, reply };
}

const rpc = (url: string, token: string, sessionId: string, method: string, params: object = {}, id = 2) =>
  call(url, token, { body: { jsonrpc: "2.0", id, method, params }, sessionId });
const toolNames = async (url: string, token: string, sessionId: string): Promise<string[]> =>
  (await rpc(url, token, sessionId, "tools/list")).message.result.tools.map((tool: { name: string }) => tool.name);
const toolText = async (url: string, token: string, sessionId: string, name: string, args: object = {}) =>
  (await rpc(url, token, sessionId, "tools/call", { name, arguments: args })).message.result.content[0].text as string;

describe("startHttpServer", () => {
  it.each([
    ["no authenticator", undefined],
    ["null", null],
    ["an empty object", {}],
    ["an authenticate that is not a function", { authenticate: "x" }],
  ])("refuses to start with %s and opens no port", async (_name, authenticator) => {
    const listen = vi.spyOn((await import("node:http")).Server.prototype, "listen");
    await expect(
      startHttpServer({ configSource: configSource(), authenticator: authenticator as never, port: 0 })
    ).rejects.toThrow("authenticator");
    expect(listen).not.toHaveBeenCalled();
  });

  it("listens on loopback by default", async () => {
    const { server } = await start();
    expect(server.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/mcp$/);
  });

  it("answers 404 for another path without creating anything", async () => {
    const { server, authenticator } = await start();
    const reply = await call(server.url.replace("/mcp", "/other"), "token-alice", { body: initializeBody });
    expect(reply.status).toBe(404);
    expect(authenticator.authenticate).not.toHaveBeenCalled();
  });
});

describe("authentication", () => {
  const bad: Array<[string, Authenticator]> = [
    ["throws", { authenticate: async () => { throw new Error("detail-xyz"); } }],
    ["returns undefined", { authenticate: async () => undefined as never }],
    ["returns an empty subject", { authenticate: async () => ({ subject: "", roles: [], claims: {} }) }],
    ["returns roles that are not a list", { authenticate: async () => ({ subject: "a", roles: "admin", claims: {} }) as never }],
  ];

  it.each(bad)("answers 401 and creates no session when the authenticator %s", async (_name, authenticator) => {
    const source = configSource();
    const { server } = await start({ authenticator, configSource: source });
    const reply = await call(server.url, "token-alice", { body: initializeBody });
    expect(reply.status).toBe(401);
    expect(reply.headers.get("www-authenticate")).toBe("Bearer");
    expect(reply.text).not.toContain("detail-xyz");
    expect(reply.headers.get("mcp-session-id")).toBeNull();
    expect(server.sessionCount()).toBe(0);
    expect(source.resolve).not.toHaveBeenCalled();
  });

  it("answers 401 without any credential", async () => {
    const { server, source } = await start();
    const reply = await call(server.url, undefined, { body: initializeBody });
    expect(reply.status).toBe(401);
    expect(reply.text).not.toContain("detail-xyz");
    expect(source.resolve).not.toHaveBeenCalled();
    expect(server.sessionCount()).toBe(0);
  });

  it("hands the authenticator a request without a body", async () => {
    const { server, authenticator } = await start();
    await call(server.url, "token-alice", { body: initializeBody });
    const request = authenticator.authenticate.mock.calls[0][0] as Request;
    expect(request.method).toBe("POST");
    expect(new URL(request.url).pathname).toBe("/mcp");
    expect(request.headers.get("authorization")).toBe("Bearer token-alice");
    expect(request.body).toBeNull();
  });

  it("authenticates every request on an existing session", async () => {
    const { server, authenticator } = await start();
    const { sessionId } = await open(server.url, "token-alice");
    const before = authenticator.authenticate.mock.calls.length;
    await toolNames(server.url, "token-alice", sessionId);
    await toolNames(server.url, "token-alice", sessionId);
    expect(authenticator.authenticate.mock.calls.length).toBe(before + 2);
    expect((await rpc(server.url, "wrong", sessionId, "tools/list")).status).toBe(401);
  });
});

describe("sessions", () => {
  it("limits each person's session to what the config source returned for them", async () => {
    const { server, source } = await start();
    const alice = await open(server.url, "token-alice");
    const bob = await open(server.url, "token-bob");
    expect(alice.reply.status).toBe(200);
    expect(alice.sessionId).not.toBe(bob.sessionId);
    expect(source.resolve).toHaveBeenCalledWith(expect.objectContaining({ subject: "alice" }));

    expect(await toolNames(server.url, "token-alice", alice.sessionId)).toContain("create_package");
    expect(await toolNames(server.url, "token-bob", bob.sessionId)).not.toContain("create_package");
    const bobTenants = await toolText(server.url, "token-bob", bob.sessionId, "get_tenant");
    expect(bobTenants).toContain("Available tenants: b_ro");
    expect(bobTenants).not.toContain("a_rw");
  });

  it("keeps one person's set_tenant away from another person's session", async () => {
    const { server } = await start();
    const alice = await open(server.url, "token-alice");
    const bob = await open(server.url, "token-bob");
    expect(await toolText(server.url, "token-alice", alice.sessionId, "set_tenant", { tenant: "a_ro" })).toContain("a_ro");
    expect(await toolNames(server.url, "token-alice", alice.sessionId)).not.toContain("create_package");
    expect(await toolText(server.url, "token-bob", bob.sessionId, "get_tenant")).toContain("Active tenant: b_ro");
  });

  it.each(["POST", "GET", "DELETE"])("refuses a %s from another subject and leaves the session alone", async (method) => {
    const { server } = await start();
    const alice = await open(server.url, "token-alice");
    const reply = await call(server.url, "token-bob", {
      method,
      sessionId: alice.sessionId,
      body: method === "POST" ? { jsonrpc: "2.0", id: 9, method: "tools/list", params: {} } : undefined,
    });
    expect(reply.status).toBe(403);
    expect(server.sessionCount()).toBe(1);
    expect(await toolNames(server.url, "token-alice", alice.sessionId)).toContain("get_package");
  });

  it("lets the owner end the session with DELETE", async () => {
    const { server } = await start();
    const alice = await open(server.url, "token-alice");
    expect((await call(server.url, "token-alice", { method: "DELETE", sessionId: alice.sessionId })).status).toBe(200);
    await vi.waitFor(() => expect(server.sessionCount()).toBe(0));
    expect((await rpc(server.url, "token-alice", alice.sessionId, "tools/list")).status).toBe(404);
  });

  it("answers 404 for an unknown session id and 400 for a request without session that is not initialize", async () => {
    const { server, source } = await start();
    expect((await rpc(server.url, "token-alice", "no-such-session", "tools/list")).status).toBe(404);
    expect((await call(server.url, "token-alice", { body: { jsonrpc: "2.0", id: 1, method: "tools/list", params: {} } })).status).toBe(400);
    expect((await call(server.url, "token-alice", { rawBody: "not json" })).status).toBe(400);
    expect((await call(server.url, "token-alice", { method: "GET" })).status).toBe(405);
    expect(source.resolve).not.toHaveBeenCalled();
    expect(server.sessionCount()).toBe(0);
  });

  it("answers 413 for a body over the limit before reading further", async () => {
    const { server } = await start();
    const reply = await call(server.url, "token-alice", { rawBody: JSON.stringify({ pad: "x".repeat(5 * 1024 * 1024) }) });
    expect(reply.status).toBe(413);
    expect(server.sessionCount()).toBe(0);
  });
});

describe("config source outcomes", () => {
  it("answers 403 and creates no session when the person has no tenant", async () => {
    const { server } = await start();
    const reply = await call(server.url, "token-zero", { body: initializeBody });
    expect(reply.status).toBe(403);
    expect(reply.headers.get("mcp-session-id")).toBeNull();
    expect(server.sessionCount()).toBe(0);
  });

  it("answers 503 without details when the config source throws", async () => {
    const throwing: ConfigSource = { resolve: async () => { throw new Error("secret-xyz"); } };
    const { server } = await start({ configSource: throwing });
    const reply = await call(server.url, "token-alice", { body: initializeBody });
    expect(reply.status).toBe(503);
    expect(reply.text).not.toContain("secret-xyz");
    expect(server.sessionCount()).toBe(0);
  });

  it("answers 503 for a config that breaks the safety rules", async () => {
    const { server } = await start();
    const reply = await call(server.url, "token-broken", { body: initializeBody });
    expect(reply.status).toBe(503);
    expect(reply.text).not.toContain("no_such_tool");
    expect(server.sessionCount()).toBe(0);
  });
});

describe("session limit", () => {
  it("answers 503 at the limit and accepts a new session after one ends", async () => {
    const { server } = await start({ maxSessions: 2 });
    const first = await open(server.url, "token-alice");
    await open(server.url, "token-bob");
    expect((await call(server.url, "token-alice", { body: initializeBody })).status).toBe(503);
    await call(server.url, "token-alice", { method: "DELETE", sessionId: first.sessionId });
    await vi.waitFor(() => expect(server.sessionCount()).toBe(1));
    expect((await call(server.url, "token-alice", { body: initializeBody })).status).toBe(200);
  });

  it("lets exactly the limit through under concurrent initialize requests", async () => {
    const { server } = await start({ maxSessions: 2 });
    const replies = await Promise.all(
      Array.from({ length: 5 }, () => call(server.url, "token-alice", { body: initializeBody }))
    );
    const statuses = replies.map((reply) => reply.status).sort();
    expect(statuses).toEqual([200, 200, 503, 503, 503]);
    expect(server.sessionCount()).toBe(2);
  });

  it("frees the reserved slot when the config source fails", async () => {
    let calls = 0;
    const flaky: ConfigSource = {
      resolve: async (principal) => {
        if (calls++ === 0) throw new Error("backend down");
        return configs[principal.subject] as TenantConfig;
      },
    };
    const { server } = await start({ maxSessions: 1, configSource: flaky });
    expect((await call(server.url, "token-alice", { body: initializeBody })).status).toBe(503);
    expect((await call(server.url, "token-alice", { body: initializeBody })).status).toBe(200);
  });

  it("closes a session that stays idle past the timeout", async () => {
    const { server } = await start({ idleTimeoutMs: 100 });
    const { sessionId } = await open(server.url, "token-alice");
    expect(server.sessionCount()).toBe(1);
    await vi.waitFor(() => expect(server.sessionCount()).toBe(0), { timeout: 3_000 });
    expect((await rpc(server.url, "token-alice", sessionId, "tools/list")).status).toBe(404);
  });
});

describe("output", () => {
  it("writes neither credentials nor claims to the console", async () => {
    const spies = (["log", "error", "warn", "info", "debug"] as const).map((level) =>
      vi.spyOn(console, level).mockImplementation(() => undefined)
    );
    const { server } = await start();
    const { sessionId } = await open(server.url, "token-alice");
    await toolNames(server.url, "token-alice", sessionId);
    await call(server.url, "wrong-token", { body: initializeBody });
    await call(server.url, "token-zero", { body: initializeBody });
    const output = spies.flatMap((spy) => spy.mock.calls.flat()).map(String).join("\n");
    for (const secret of ["token-alice", "wrong-token", "claim-marker-alice", "detail-xyz", "secret"]) {
      expect(output).not.toContain(secret);
    }
  });
});

describe("review fixes", () => {
  it("does not keep a session when the client disconnects during initialize", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    let resolved = false;
    const slow: ConfigSource = {
      resolve: async (principal) => {
        await gate;
        resolved = true;
        return configs[principal.subject] as TenantConfig;
      },
    };
    const { server } = await start({ configSource: slow });
    const controller = new AbortController();
    const pending = fetch(server.url, {
      method: "POST",
      headers: { Authorization: "Bearer token-alice", "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
      body: JSON.stringify(initializeBody),
      signal: controller.signal,
    }).catch(() => undefined);
    await new Promise((resolve) => setTimeout(resolve, 100));
    controller.abort();
    await pending;
    await new Promise((resolve) => setTimeout(resolve, 100));
    release();
    await vi.waitFor(() => expect(resolved).toBe(true));
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(server.sessionCount()).toBe(0);
  });

  it("does not pass credentials on to the transport, and so not to tool handlers", async () => {
    const seen: Request[] = [];
    const original = WebStandardStreamableHTTPServerTransport.prototype.handleRequest;
    vi.spyOn(WebStandardStreamableHTTPServerTransport.prototype, "handleRequest").mockImplementation(function (this: unknown, request, options) {
      seen.push(request);
      return original.call(this as never, request, options);
    });
    const { server } = await start();
    const headers = { Cookie: "sid=cookie-secret", "Proxy-Authorization": "Basic proxy-secret" };
    const init = await fetch(server.url, {
      method: "POST",
      headers: { ...headers, Authorization: "Bearer token-alice", "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
      body: JSON.stringify(initializeBody),
    });
    const sessionId = init.headers.get("mcp-session-id")!;
    await init.text();
    await toolNames(server.url, "token-alice", sessionId);
    expect(seen.length).toBeGreaterThanOrEqual(2);
    for (const request of seen) {
      for (const name of ["authorization", "cookie", "proxy-authorization"]) {
        expect(request.headers.get(name)).toBeNull();
      }
    }
  });

  it("refuses and ends a session when the person's roles changed since it started", async () => {
    let roles = ["writer"];
    const authenticator: Authenticator = {
      authenticate: async () => ({ subject: "alice", roles: [...roles], claims: {} }),
    };
    const { server } = await start({ authenticator });
    const { sessionId } = await open(server.url, "token-any");
    expect((await rpc(server.url, "token-any", sessionId, "tools/list")).status).toBe(200);
    roles = ["writer"].reverse();
    expect((await rpc(server.url, "token-any", sessionId, "tools/list")).status).toBe(200);
    roles = ["reader"];
    expect((await rpc(server.url, "token-any", sessionId, "tools/list")).status).toBe(403);
    await vi.waitFor(() => expect(server.sessionCount()).toBe(0));
    expect((await rpc(server.url, "token-any", sessionId, "tools/list")).status).toBe(404);
    const again = await open(server.url, "token-any");
    expect(again.reply.status).toBe(200);
  });
});

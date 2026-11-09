import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { InMemoryTransport, type JSONRPCMessage } from "@modelcontextprotocol/server";
import { buildServer } from "../server.js";
import { classifyTool } from "../core/tool-access.js";
import type { TenantConfig } from "../core/types.js";

const connection = {
  apiUrl: "https://ro.example.com",
  oauthUrl: "https://ro.example.com/oauth/token",
  clientId: "id",
  clientSecret: "secret",
};

const config: TenantConfig = {
  tenants: {
    ro: { name: "RO", ...connection, settings: { readOnly: true } },
    rw: { name: "RW", ...connection, settings: { readOnly: false } },
  },
  defaultTenant: "ro",
};

/** Speaks raw JSON-RPC to the fully wired server over an in-memory transport. */
async function connect() {
  const { server } = buildServer(config);
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  const pending = new Map<number, (message: any) => void>();
  clientSide.onmessage = (message: JSONRPCMessage) => {
    const id = (message as { id?: number }).id;
    if (id !== undefined && pending.has(id)) {
      pending.get(id)!(message);
      pending.delete(id);
    }
  };
  await server.connect(serverSide);
  await clientSide.start();
  let nextId = 0;
  const request = (method: string, params: Record<string, unknown>) =>
    new Promise<any>((resolve) => {
      const id = ++nextId;
      pending.set(id, resolve);
      void clientSide.send({ jsonrpc: "2.0", id, method, params } as JSONRPCMessage);
    });
  const init = await request("initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "test", version: "0" },
  });
  await clientSide.send({ jsonrpc: "2.0", method: "notifications/initialized" } as JSONRPCMessage);
  const toolNames = async (): Promise<string[]> =>
    (await request("tools/list", {})).result.tools.map((tool: { name: string }) => tool.name);
  return { request, toolNames, serverInfo: init.result.serverInfo, close: () => server.close() };
}

describe("buildServer on a read-only default tenant", () => {
  afterEach(() => vi.restoreAllMocks());

  it("lists no write-classified tool", async () => {
    const { toolNames, close } = await connect();
    const names = await toolNames();
    expect(names).toContain("get_package");
    expect(names).toContain("execute_guidelines");
    expect(names.filter((name) => classifyTool(name) !== "read")).toEqual([]);
    await close();
  });

  it("refuses a write tool call without any HTTP request", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { request, close } = await connect();
    const response = await request("tools/call", {
      name: "create_package",
      arguments: { id: "X", name: "X", confirm: true },
    });
    expect(response.error ?? response.result?.isError).toBeTruthy();
    expect(fetchSpy).not.toHaveBeenCalled();
    await close();
  });

  it("shows write tools after switching to a writable tenant", async () => {
    const { request, toolNames, close } = await connect();
    await request("tools/call", { name: "set_tenant", arguments: { tenant: "rw" } });
    expect(await toolNames()).toContain("create_package");
    await close();
  });
});

describe("server version", () => {
  const packageVersion = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf-8")).version;

  it("reports the package.json version in the handshake and in get_tenant", async () => {
    const { request, serverInfo, close } = await connect();
    expect(serverInfo).toEqual({ name: "mcp-ci", version: packageVersion });
    const result = await request("tools/call", { name: "get_tenant", arguments: {} });
    expect(result.result.content[0].text).toContain(`Server version: ${packageVersion}`);
    await close();
  });
});

import { InMemoryTransport, type JSONRPCMessage } from "@modelcontextprotocol/server";
import { buildServer } from "../../src/server.js";
import type { Measurement } from "./types.js";

const connection = {
  apiUrl: "https://tenant.example.com",
  oauthUrl: "https://tenant.example.com/oauth/token",
  clientId: "id",
  clientSecret: "secret",
};

/**
 * Size of the `tools/list` result a client receives for a read-only tenant, or
 * for a writable tenant with payloads allowed (every tool visible).
 */
export async function measureToolSchemas(readOnly: boolean): Promise<Measurement> {
  const { server } = buildServer({
    tenants: { t: { name: "T", ...connection, settings: { readOnly, allowPayloads: !readOnly } } },
    defaultTenant: "t",
  });
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
  try {
    await request("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "schema-budget", version: "0" },
    });
    await clientSide.send({ jsonrpc: "2.0", method: "notifications/initialized" } as JSONRPCMessage);
    const tools: { name: string }[] = (await request("tools/list", {})).result.tools;
    const largest = tools
      .map((tool) => ({ name: tool.name, chars: JSON.stringify(tool).length }))
      .sort((a, b) => b.chars - a.chars)
      .slice(0, 10);
    return { tools: tools.length, chars: JSON.stringify(tools).length, largest };
  } finally {
    await server.close();
  }
}

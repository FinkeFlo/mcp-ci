import { describe, it, expect } from "vitest";
import { createMockClient } from "../mock-client.js";

describe("mock OData client", () => {
  it("serves synthetic failed messages, runtime artifacts and keystore entries", async () => {
    const client = createMockClient();
    const failed = await client.getCollection<{ Status: string }>("/api/v1/MessageProcessingLogs", { $filter: "Status eq 'FAILED'" });
    expect(failed.length).toBeGreaterThan(0);
    expect(failed.every((m) => m.Status === "FAILED")).toBe(true);
    expect((await client.getCollection("/api/v1/IntegrationRuntimeArtifacts")).length).toBeGreaterThan(0);
    expect((await client.getCollection("/api/v1/KeystoreEntries?keystoreName=system")).length).toBeGreaterThan(0);
  });

  it("refuses every write", async () => {
    const client = createMockClient();
    await expect(client.post("/api/v1/IntegrationPackages", {})).rejects.toThrow(/eval backend is read-only/);
    await expect(client.delete("/api/v1/IntegrationPackages('X')")).rejects.toThrow(/read-only/);
  });
});

describe("eval server", () => {
  it("answers a tool call with mock data through the real server", async () => {
    const { InMemoryTransport } = await import("@modelcontextprotocol/server");
    const { buildEvalServer } = await import("../eval-server.js");
    const { server } = buildEvalServer();
    const [client, serverSide] = InMemoryTransport.createLinkedPair();
    const pending = new Map<number, (m: any) => void>();
    client.onmessage = (m: any) => pending.get(m.id)?.(m);
    await server.connect(serverSide);
    await client.start();
    let id = 0;
    const request = (method: string, params: Record<string, unknown>) =>
      new Promise<any>((resolve) => {
        pending.set(++id, resolve);
        void client.send({ jsonrpc: "2.0", id, method, params } as any);
      });
    await request("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "0" } });
    await client.send({ jsonrpc: "2.0", method: "notifications/initialized" } as any);
    const result = await request("tools/call", { name: "get_errors", arguments: {} });
    expect(result.result.content[0].text).toContain("TestFlow_Orders");
    await server.close();
  });
});

import { InMemoryTransport, type JSONRPCMessage, type McpServer } from "@modelcontextprotocol/server";

/** Speaks raw JSON-RPC to `server` over an in-memory transport. */
export async function connectClient(server: McpServer) {
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
  const request = (method: string, params: Record<string, unknown> = {}) =>
    new Promise<any>((resolve) => {
      const id = ++nextId;
      pending.set(id, resolve);
      void clientSide.send({ jsonrpc: "2.0", id, method, params } as JSONRPCMessage);
    });
  await request("initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "test", version: "0" },
  });
  await clientSide.send({ jsonrpc: "2.0", method: "notifications/initialized" } as JSONRPCMessage);
  return {
    request,
    toolNames: async (): Promise<string[]> =>
      (await request("tools/list")).result.tools.map((tool: { name: string }) => tool.name),
    /** The tool result text, or the JSON-RPC error message; `isError` says which kind of failure. */
    callTool: async (name: string, args: Record<string, unknown> = {}) => {
      const response = await request("tools/call", { name, arguments: args });
      const failed = Boolean(response.error ?? response.result?.isError);
      const text: string = response.error?.message ?? response.result?.content?.[0]?.text ?? "";
      return { failed, text, response };
    },
    close: () => server.close(),
  };
}

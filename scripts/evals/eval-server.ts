import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import { buildServer } from "../../src/server.js";
import { createMockClient } from "./mock-client.js";

/** The real server with every module, a read-only eval tenant and mock data. */
export function buildEvalServer() {
  return buildServer(
    {
      tenants: {
        eval: {
          name: "EVAL",
          apiUrl: "https://tenant.example.com",
          oauthUrl: "https://tenant.example.com/oauth/token",
          clientId: "eval",
          clientSecret: "eval",
          settings: { readOnly: true },
        },
      },
      defaultTenant: "eval",
    },
    { odataClient: createMockClient() }
  );
}

if (process.argv[1]?.endsWith("eval-server.ts")) {
  await buildEvalServer().server.connect(new StdioServerTransport());
}

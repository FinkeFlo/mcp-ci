import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Module, ModuleContext } from "../../core/types.js";
import { registerCredentialTools } from "./tools/credentials.js";
import { registerKeystoreTools } from "./tools/keystore.js";
import { registerCertificateTools } from "./tools/certificates.js";
import { registerAccessPolicyTools } from "./tools/access-policies.js";

export const securityModule: Module = {
  name: "security",
  register(server: McpServer, context: ModuleContext) {
    registerCredentialTools(server, context);
    registerKeystoreTools(server, context);
    registerCertificateTools(server, context);
    registerAccessPolicyTools(server, context);
  },
};

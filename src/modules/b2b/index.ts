import type { McpServer } from "@modelcontextprotocol/server";
import type { Module, ModuleContext } from "../../core/types.js";
import { registerOrphanedInterchangeTools } from "./tools/orphaned-interchanges.js";
import { registerBusinessDocumentTools } from "./tools/business-documents.js";
import { registerB2BArchivingTools } from "./tools/archiving.js";

export const b2bModule: Module = {
  name: "b2b",
  register(server: McpServer, context: ModuleContext) {
    registerOrphanedInterchangeTools(server, context);
    registerBusinessDocumentTools(server, context);
    registerB2BArchivingTools(server, context);
  },
};

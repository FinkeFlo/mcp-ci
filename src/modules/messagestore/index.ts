import type { McpServer } from "@modelcontextprotocol/server";
import type { Module, ModuleContext } from "../../core/types.js";
import { registerEntryTools } from "./tools/entries.js";
import { registerJmsTools } from "./tools/jms.js";
import { registerNumberRangeTools } from "./tools/number-ranges.js";
import { registerDataStoreTools } from "./tools/data-stores.js";
import { registerVariableTools } from "./tools/variables.js";

export const messagestoreModule: Module = {
  name: "messagestore",
  register(server: McpServer, context: ModuleContext) {
    registerEntryTools(server, context);
    registerJmsTools(server, context);
    registerNumberRangeTools(server, context);
    registerDataStoreTools(server, context);
    registerVariableTools(server, context);
  },
};

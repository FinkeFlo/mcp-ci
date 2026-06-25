import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Module, ModuleContext } from "../../core/types.js";
import { registerRuntimeTools } from "./tools/runtime.js";
import { registerPackageTools } from "./tools/packages.js";
import { registerFlowTools } from "./tools/flows.js";
import { registerEndpointTools } from "./tools/endpoints.js";
import { registerDeployStatusTools } from "./tools/deploy-status.js";
import { registerValueMappingTools } from "./tools/value-mappings.js";
import { registerMessageMappingTools } from "./tools/message-mappings.js";
import { registerScriptCollectionTools } from "./tools/script-collections.js";
import { registerDesignGuidelineTools } from "./tools/design-guidelines.js";
import { registerCustomTagTools } from "./tools/custom-tags.js";
import { registerTypeArtifactTools } from "./tools/type-artifacts.js";
import { registerAdapterTools } from "./tools/adapters.js";
import { registerPackageArtifactTools } from "./tools/package-artifacts.js";

export const contentModule: Module = {
  name: "content",
  register(server: McpServer, context: ModuleContext) {
    registerRuntimeTools(server, context);
    registerPackageTools(server, context);
    registerFlowTools(server, context);
    registerEndpointTools(server, context);
    registerDeployStatusTools(server, context);
    registerValueMappingTools(server, context);
    registerMessageMappingTools(server, context);
    registerScriptCollectionTools(server, context);
    registerDesignGuidelineTools(server, context);
    registerCustomTagTools(server, context);
    registerTypeArtifactTools(server, context);
    registerAdapterTools(server, context);
    registerPackageArtifactTools(server, context);
  },
};

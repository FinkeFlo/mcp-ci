import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import type { ModuleContext } from "../../../core/types.js";
import { textTool } from "../../../core/tool.js";
import type { Variable } from "../types.js";
import {
  buildVariablesPath,
  buildVariablePath,
  buildVariableValuePath,
} from "../queries.js";

function formatVariable(v: Variable): string {
  return [
    `VariableName: ${v.VariableName ?? "n/a"}`,
    `IntegrationFlow: ${v.IntegrationFlow ?? "n/a"}`,
    `Visibility: ${v.Visibility ?? "n/a"}`,
    `UpdatedAt: ${v.UpdatedAt ?? "n/a"}`,
    `RetainUntil: ${v.RetainUntil ?? "n/a"}`,
  ].join("\n");
}

export function registerVariableTools(
  server: McpServer,
  context: ModuleContext
) {
  // @api GET /Variables
  server.registerTool(
    "list_variables",
    {
      description:
        "List all variables on the active SAP Cloud Integration tenant.",
      inputSchema: z.object({}),
    },
    textTool(async () => {
      const variables =
        await context.odataClient.getCollection<Variable>(
          buildVariablesPath()
        );
      if (variables.length === 0) {
        return "No variables found.";
      }
      const text = variables.map(formatVariable).join("\n\n");
      return text;
    })
  );

  // @api GET /Variables(VariableName='{VariableName}',IntegrationFlow='{IntegrationFlowId}')
  server.registerTool(
    "get_variable",
    {
      description:
        "Get a specific variable by its composite key (VariableName, IntegrationFlow).",
      inputSchema: z.object({
        variableName: z.string().describe("The variable name"),
        integrationFlow: z
          .string()
          .describe("The integration flow ID"),
      }),
    },
    textTool(async ({ variableName, integrationFlow }) => {
      const variable = await context.odataClient.getEntity<Variable>(
        buildVariablePath(variableName, integrationFlow)
      );
      const text = formatVariable(variable);
      return text;
    })
  );

  // @api GET /Variables(VariableName='{VariableName}',IntegrationFlow='{IntegrationFlowId}')
  // @api DELETE /Variables(VariableName='{VariableName}',IntegrationFlow='{IntegrationFlowId}')
  server.registerTool(
    "delete_variable",
    {
      description:
        "Delete a variable by its composite key. Without confirm, shows a preview. Set confirm to true to execute.",
      inputSchema: z.object({
        variableName: z.string().describe("The variable name"),
        integrationFlow: z
          .string()
          .describe("The integration flow ID"),
        confirm: z
          .boolean()
          .optional()
          .describe("Set to true to actually delete the variable"),
      }),
    },
    textTool(async ({ variableName, integrationFlow, confirm }) => {
      const path = buildVariablePath(variableName, integrationFlow);
      if (!confirm) {
        const variable =
          await context.odataClient.getEntity<Variable>(path);
        const preview = formatVariable(variable);
        return `Variable to delete:\n\n${preview}\n\nSet confirm to true to proceed.`;
      }
      await context.odataClient.delete(path);
      return `Variable '${variableName}' deleted successfully.`;
    })
  );

  // @api GET /Variables(VariableName='{VariableName}',IntegrationFlow='{IntegrationFlowId}')/$value
  server.registerTool(
    "download_variable",
    {
      description:
        "Download the content of a variable by its composite key (VariableName, IntegrationFlow).",
      inputSchema: z.object({
        variableName: z.string().describe("The variable name"),
        integrationFlow: z
          .string()
          .describe("The integration flow ID"),
      }),
    },
    textTool(async ({ variableName, integrationFlow }) => {
      const content = await context.odataClient.getValue(
        buildVariableValuePath(variableName, integrationFlow)
      );
      if (!content) {
        return "No variable content available.";
      }
      return content;
    })
  );
}

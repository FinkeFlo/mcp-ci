import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type { ModuleContext } from "../../../core/types.js";
import type { MdiDeltaToken } from "../types.js";
import { escapeOData } from "../../../core/odata-utils.js";
import {
  buildAdaptersPath,
  buildAdapterPath,
  buildDeployAdapterPath,
  buildMdiDeltaTokenPath,
} from "../queries.js";

export function registerAdapterTools(
  server: McpServer,
  context: ModuleContext
) {
  // @api POST /IntegrationAdapterDesigntimeArtifacts
  // @api POST /DeployIntegrationAdapterDesigntimeArtifact
  server.registerTool(
    "deploy_integration_adapter",
    {
      description:
        "Deploy an integration adapter on the active SAP Cloud Integration tenant. Without confirm, shows a preview. Set confirm to true to execute the import and deploy.",
      inputSchema: z.object({
        id: z.string().describe("The adapter ID to deploy"),
        name: z
          .string()
          .optional()
          .describe("Optional adapter name"),
        confirm: z
          .boolean()
          .optional()
          .describe("Set to true to actually deploy the adapter"),
      }),
    },
    async ({ id, name, confirm }) => {
      try {
        if (!confirm) {
          const lines: string[] = [];
          lines.push("Adapter to deploy:");
          lines.push("");
          lines.push(`Id: ${id}`);
          lines.push(`Name: ${name ?? "(not specified)"}`);
          lines.push("");
          lines.push("Set confirm to true to proceed.");
          return {
            content: [{ type: "text" as const, text: lines.join("\n") }],
          };
        }
        const body: Record<string, unknown> = { Id: id };
        if (name !== undefined) body.Name = name;
        await context.odataClient.post(buildAdaptersPath(), body);
        await context.odataClient.post(
          buildDeployAdapterPath() + "?Id='" + escapeOData(id) + "'"
        );
        return {
          content: [
            {
              type: "text" as const,
              text: `Adapter '${id}' deployed successfully.`,
            },
          ],
        };
      } catch (error) {
        return {
          isError: true,
          content: [
            { type: "text" as const, text: (error as Error).message },
          ],
        };
      }
    }
  );

  // @api DELETE /IntegrationAdapterDesigntimeArtifacts(Id='{Id}')
  server.registerTool(
    "delete_integration_adapter",
    {
      description:
        "Delete an integration adapter from the active SAP Cloud Integration tenant. Without confirm, shows a preview. Set confirm to true to execute.",
      inputSchema: z.object({
        id: z.string().describe("The adapter ID to delete"),
        confirm: z
          .boolean()
          .optional()
          .describe("Set to true to actually delete the adapter"),
      }),
    },
    async ({ id, confirm }) => {
      try {
        if (!confirm) {
          const lines: string[] = [];
          lines.push("Adapter to delete:");
          lines.push("");
          lines.push(`Id: ${id}`);
          lines.push("");
          lines.push("Set confirm to true to proceed.");
          return {
            content: [{ type: "text" as const, text: lines.join("\n") }],
          };
        }
        await context.odataClient.delete(buildAdapterPath(id));
        return {
          content: [
            {
              type: "text" as const,
              text: `Adapter '${id}' deleted successfully.`,
            },
          ],
        };
      } catch (error) {
        return {
          isError: true,
          content: [
            { type: "text" as const, text: (error as Error).message },
          ],
        };
      }
    }
  );

  // @api GET /MDIDeltaToken(Operation='{Operation}',Entity='{Entity}',Version='{Version}')
  server.registerTool(
    "get_mdi_delta_token",
    {
      description:
        "Get the MDI delta token for a specific operation, entity, and version.",
      inputSchema: z.object({
        operation: z.string().describe("The operation name"),
        entity: z.string().describe("The entity name"),
        version: z.string().describe("The version"),
      }),
    },
    async ({ operation, entity, version }) => {
      try {
        const token =
          await context.odataClient.getEntity<MdiDeltaToken>(
            buildMdiDeltaTokenPath(operation, entity, version)
          );
        const lines: string[] = [];
        lines.push(`Operation: ${token.Operation}`);
        lines.push(`Entity: ${token.Entity}`);
        lines.push(`Version: ${token.Version}`);
        lines.push(`DeltaToken: ${token.DeltaToken ?? "n/a"}`);
        lines.push(`LastUpdateTimestamp: ${token.LastUpdateTimestamp ?? "n/a"}`);
        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
        };
      } catch (error) {
        return {
          isError: true,
          content: [
            { type: "text" as const, text: (error as Error).message },
          ],
        };
      }
    }
  );
}

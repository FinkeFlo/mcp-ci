import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type { ModuleContext } from "../../../core/types.js";
import type {
  MessageTypeDesigntimeArtifact,
  DataTypeDesigntimeArtifact,
  FaultMessageTypeDesigntimeArtifact,
  ServiceInterfaceDesigntimeArtifact,
} from "../types.js";
import {
  buildTypeArtifactsPath,
  buildTypeArtifactPath,
} from "../queries.js";

type TypeArtifact =
  | MessageTypeDesigntimeArtifact
  | DataTypeDesigntimeArtifact
  | FaultMessageTypeDesigntimeArtifact
  | ServiceInterfaceDesigntimeArtifact;

function formatTypeArtifactList(a: TypeArtifact): string {
  const desc = a.Description ?? "n/a";
  const truncatedDesc = desc.length > 100 ? desc.slice(0, 100) + "..." : desc;
  const lines: string[] = [];
  lines.push(`Id: ${a.Id ?? "n/a"}`);
  lines.push(`Name: ${a.Name ?? "n/a"}`);
  lines.push(`Version: ${a.Version ?? "n/a"}`);
  lines.push(`PackageId: ${a.PackageId ?? "n/a"}`);
  lines.push(`Namespace: ${a.Namespace ?? "n/a"}`);
  lines.push(`Description: ${truncatedDesc}`);
  return lines.join("\n");
}

function formatTypeArtifactDetail(a: TypeArtifact): string {
  const lines: string[] = [];
  lines.push(`Id: ${a.Id ?? "n/a"}`);
  lines.push(`Name: ${a.Name ?? "n/a"}`);
  lines.push(`Version: ${a.Version ?? "n/a"}`);
  lines.push(`PackageId: ${a.PackageId ?? "n/a"}`);
  lines.push(`Namespace: ${a.Namespace ?? "n/a"}`);
  lines.push(`Description: ${a.Description ?? "n/a"}`);
  return lines.join("\n");
}

function registerTypeTools(
  server: McpServer,
  context: ModuleContext,
  toolPrefix: string,
  entityName: string,
  displayName: string
) {
  // list tool
  server.registerTool(
    `list_${toolPrefix}s`,
    {
      description: `List ${displayName}s on the active SAP Cloud Integration tenant.`,
      inputSchema: z.object({
        filter: z
          .string()
          .optional()
          .describe("OData $filter expression"),
        top: z
          .number()
          .optional()
          .describe("Maximum number of results to return"),
        skip: z
          .number()
          .optional()
          .describe("Number of results to skip (for pagination)"),
      }),
    },
    async ({ filter, top, skip }) => {
      try {
        const artifacts =
          await context.odataClient.getCollection<TypeArtifact>(
            buildTypeArtifactsPath(entityName),
            {
              $filter: filter,
              $top: top,
              $skip: skip,
            }
          );
        if (artifacts.length === 0) {
          return {
            content: [
              { type: "text" as const, text: `No ${displayName}s found.` },
            ],
          };
        }
        const text = artifacts.map(formatTypeArtifactList).join("\n\n");
        return {
          content: [{ type: "text" as const, text }],
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

  // get tool
  server.registerTool(
    `get_${toolPrefix}`,
    {
      description: `Get details of a specific ${displayName} by its ID.`,
      inputSchema: z.object({
        id: z.string().describe("The artifact ID"),
        version: z
          .string()
          .optional()
          .describe("The artifact version (default: 'active')"),
      }),
    },
    async ({ id, version }) => {
      try {
        const artifact =
          await context.odataClient.getEntity<TypeArtifact>(
            buildTypeArtifactPath(entityName, id, version ?? "active")
          );
        const text = formatTypeArtifactDetail(artifact);
        return {
          content: [{ type: "text" as const, text }],
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

export function registerTypeArtifactTools(
  server: McpServer,
  context: ModuleContext
) {
  registerTypeTools(server, context, "message_type", "MessageTypeDesigntimeArtifacts", "message type");
  registerTypeTools(server, context, "data_type", "DataTypeDesigntimeArtifacts", "data type");
  registerTypeTools(server, context, "fault_message_type", "FaultMessageTypeDesigntimeArtifacts", "fault message type");
  registerTypeTools(server, context, "service_interface", "ServiceInterfaceDesigntimeArtifacts", "service interface");
}

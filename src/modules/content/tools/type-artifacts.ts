import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import type { ModuleContext } from "../../../core/types.js";
import { textTool } from "../../../core/tool.js";
import type {
  MessageTypeDesigntimeArtifact,
  DataTypeDesigntimeArtifact,
  FaultMessageTypeDesigntimeArtifact,
  ServiceInterfaceDesigntimeArtifact,
} from "../types.js";
import {
  buildTypeArtifactsPath,
  buildTypeArtifactPath,
  buildTypeArtifactValuePath,
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
  // @api GET /MessageTypeDesigntimeArtifacts
  // @api GET /DataTypeDesigntimeArtifacts
  // @api GET /FaultMessageTypeDesigntimeArtifacts
  // @api GET /ServiceInterfaceDesigntimeArtifacts
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
    textTool(async ({ filter, top, skip }) => {
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
        return `No ${displayName}s found.`;
      }
      const text = artifacts.map(formatTypeArtifactList).join("\n\n");
      return text;
    })
  );

  // get tool
  // @api GET /MessageTypeDesigntimeArtifacts(Id='{Id}',Version='{Version}')
  // @api GET /DataTypeDesigntimeArtifacts(Id='{Id}',Version='{Version}')
  // @api GET /FaultMessageTypeDesigntimeArtifacts(Id='{Id}',Version='{Version}')
  // @api GET /ServiceInterfaceDesigntimeArtifacts(Id='{Id}',Version='{Version}')
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
    textTool(async ({ id, version }) => {
      const artifact =
        await context.odataClient.getEntity<TypeArtifact>(
          buildTypeArtifactPath(entityName, id, version ?? "active")
        );
      const text = formatTypeArtifactDetail(artifact);
      return text;
    })
  );

  // download tool
  // @api GET /MessageTypeDesigntimeArtifacts(Id='{Id}',Version='{Version}')/$value
  // @api GET /DataTypeDesigntimeArtifacts(Id='{Id}',Version='{Version}')/$value
  // @api GET /FaultMessageTypeDesigntimeArtifacts(Id='{Id}',Version='{Version}')/$value
  // @api GET /ServiceInterfaceDesigntimeArtifacts(Id='{Id}',Version='{Version}')/$value
  server.registerTool(
    `download_${toolPrefix}`,
    {
      description: `Download a ${displayName} artifact as a ZIP file.`,
      inputSchema: z.object({
        id: z.string().describe("The artifact ID"),
        version: z
          .string()
          .optional()
          .describe("The artifact version (default: 'active')"),
      }),
    },
    textTool(async ({ id, version }) => {
      const content = await context.odataClient.getValue(
        buildTypeArtifactValuePath(entityName, id, version ?? "active")
      );
      return `Artifact '${id}' downloaded successfully. Content length: ${content.length} bytes (binary ZIP data).`;
    })
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

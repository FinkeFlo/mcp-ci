import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import type { ModuleContext } from "../../../core/types.js";
import type { ServiceEndpoint } from "../types.js";
import {
  buildServiceEndpointsPath,
  buildServiceEndpointsCountPath,
} from "../queries.js";

function formatEndpoint(e: ServiceEndpoint): string {
  const lines: string[] = [];
  lines.push(`Name: ${e.Name ?? "n/a"}`);
  lines.push(`Id: ${e.Id ?? "n/a"}`);
  lines.push(`Title: ${e.Title ?? "n/a"}`);
  lines.push(`Version: ${e.Version ?? "n/a"}`);
  lines.push(`Protocol: ${e.Protocol ?? "n/a"}`);
  lines.push(`LastUpdated: ${e.LastUpdated ?? "n/a"}`);
  return lines.join("\n");
}

export function registerEndpointTools(
  server: McpServer,
  context: ModuleContext
) {
  // @api GET /ServiceEndpoints
  server.registerTool(
    "list_service_endpoints",
    {
      description:
        "List service endpoints on the active SAP Cloud Integration tenant. Supports OData query options for filtering, selection, expansion, and pagination.",
      inputSchema: z.object({
        filter: z
          .string()
          .optional()
          .describe("OData $filter expression, e.g. \"Protocol eq 'REST'\""),
        select: z
          .string()
          .optional()
          .describe("OData $select fields, e.g. \"Name,Id,Protocol\""),
        expand: z
          .string()
          .optional()
          .describe(
            "OData $expand navigation properties: \"EntryPoints\", \"ApiDefinitions\""
          ),
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
    async ({ filter, select, expand, top, skip }) => {
      try {
        const endpoints =
          await context.odataClient.getCollection<ServiceEndpoint>(
            buildServiceEndpointsPath(),
            {
              $filter: filter,
              $select: select,
              $expand: expand,
              $top: top,
              $skip: skip,
            }
          );
        if (endpoints.length === 0) {
          return {
            content: [
              { type: "text" as const, text: "No service endpoints found." },
            ],
          };
        }
        const text = endpoints.map(formatEndpoint).join("\n\n");
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

  // @api GET /ServiceEndpoints/$count
  server.registerTool(
    "count_service_endpoints",
    {
      description:
        "Count service endpoints on the active SAP Cloud Integration tenant.",
      inputSchema: z.object({}),
    },
    async () => {
      try {
        const count = await context.odataClient.getValue(
          buildServiceEndpointsCountPath()
        );
        return {
          content: [{ type: "text" as const, text: count }],
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

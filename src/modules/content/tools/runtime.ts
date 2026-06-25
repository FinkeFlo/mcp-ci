import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type { ModuleContext } from "../../../core/types.js";
import type { IntegrationRuntimeArtifact } from "../types.js";
import {
  buildRuntimeArtifactsPath,
  buildRuntimeArtifactPath,
  buildRuntimeArtifactsCountPath,
  buildRuntimeArtifactErrorPath,
} from "../queries.js";

function parseODataDate(value: string | null): string {
  if (!value) return "n/a";
  const match = value.match(/\/Date\((\d+)\)\//);
  if (match) return new Date(parseInt(match[1])).toISOString();
  return value;
}

function formatArtifact(a: IntegrationRuntimeArtifact): string {
  const lines: string[] = [];
  lines.push(`Id: ${a.Id ?? "n/a"}`);
  lines.push(`Name: ${a.Name ?? "n/a"}`);
  lines.push(`Version: ${a.Version ?? "n/a"}`);
  lines.push(`Type: ${a.Type ?? "n/a"}`);
  lines.push(`Status: ${a.Status ?? "n/a"}`);
  lines.push(`DeployedBy: ${a.DeployedBy ?? "n/a"}`);
  lines.push(`DeployedOn: ${parseODataDate(a.DeployedOn)}`);
  return lines.join("\n");
}

export function registerRuntimeTools(
  server: McpServer,
  context: ModuleContext
) {
  // @api GET /IntegrationRuntimeArtifacts
  server.registerTool(
    "list_runtime_artifacts",
    {
      description:
        "List deployed runtime artifacts on the active SAP Cloud Integration tenant. Supports OData query options for filtering, sorting, and pagination.",
      inputSchema: z.object({
        filter: z
          .string()
          .optional()
          .describe("OData $filter expression, e.g. \"Status eq 'ERROR'\""),
        select: z
          .string()
          .optional()
          .describe("OData $select fields, e.g. \"Id,Name,Status\""),
        orderby: z
          .string()
          .optional()
          .describe("OData $orderby expression, e.g. \"DeployedOn desc\""),
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
    async ({ filter, select, orderby, top, skip }) => {
      try {
        const artifacts =
          await context.odataClient.getCollection<IntegrationRuntimeArtifact>(
            buildRuntimeArtifactsPath(),
            {
              $filter: filter,
              $select: select,
              $orderby: orderby,
              $top: top,
              $skip: skip,
            }
          );
        if (artifacts.length === 0) {
          return {
            content: [
              { type: "text" as const, text: "No deployed artifacts found." },
            ],
          };
        }
        const text = artifacts.map(formatArtifact).join("\n\n");
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

  // @api GET /IntegrationRuntimeArtifacts('{Id}')
  server.registerTool(
    "get_runtime_artifact",
    {
      description:
        "Get details of a specific deployed runtime artifact by its ID.",
      inputSchema: z.object({
        id: z.string().describe("The artifact ID"),
      }),
    },
    async ({ id }) => {
      try {
        const artifact =
          await context.odataClient.getEntity<IntegrationRuntimeArtifact>(
            buildRuntimeArtifactPath(id)
          );
        const text = formatArtifact(artifact);
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

  // @api GET /IntegrationRuntimeArtifacts/$count
  server.registerTool(
    "count_runtime_artifacts",
    {
      description:
        "Count deployed runtime artifacts. Optionally filter by OData filter expression.",
      inputSchema: z.object({
        filter: z
          .string()
          .optional()
          .describe("OData $filter expression, e.g. \"Type eq 'INTEGRATION_FLOW'\""),
      }),
    },
    async ({ filter }) => {
      try {
        const path = filter
          ? `${buildRuntimeArtifactsCountPath()}?$filter=${encodeURIComponent(filter)}`
          : buildRuntimeArtifactsCountPath();
        const count = await context.odataClient.getValue(path);
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

  // @api GET /IntegrationRuntimeArtifacts('{Id}')/ErrorInformation/$value
  server.registerTool(
    "get_runtime_artifact_error",
    {
      description:
        "Get the error information for a deployed runtime artifact that is in error state.",
      inputSchema: z.object({
        id: z.string().describe("The artifact ID"),
      }),
    },
    async ({ id }) => {
      try {
        const errorText = await context.odataClient.getValue(
          buildRuntimeArtifactErrorPath(id)
        );
        if (!errorText) {
          return {
            content: [
              {
                type: "text" as const,
                text: "No error information available.",
              },
            ],
          };
        }
        return {
          content: [{ type: "text" as const, text: errorText }],
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

  // @api GET /IntegrationRuntimeArtifacts('{Id}')
  // @api DELETE /IntegrationRuntimeArtifacts('{Id}')
  server.registerTool(
    "undeploy_runtime_artifact",
    {
      description:
        "Undeploy a runtime artifact from the active SAP Cloud Integration tenant. Without confirm, shows a preview. Set confirm to true to execute.",
      inputSchema: z.object({
        id: z.string().describe("The artifact ID to undeploy"),
        confirm: z
          .boolean()
          .optional()
          .describe("Set to true to actually undeploy the artifact"),
      }),
    },
    async ({ id, confirm }) => {
      try {
        if (!confirm) {
          const artifact =
            await context.odataClient.getEntity<IntegrationRuntimeArtifact>(
              buildRuntimeArtifactPath(id)
            );
          const preview = formatArtifact(artifact);
          return {
            content: [
              {
                type: "text" as const,
                text: `Artifact to undeploy:\n\n${preview}\n\nSet confirm to true to proceed.`,
              },
            ],
          };
        }
        await context.odataClient.delete(buildRuntimeArtifactPath(id));
        return {
          content: [
            {
              type: "text" as const,
              text: `Artifact '${id}' undeployed successfully.`,
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
}

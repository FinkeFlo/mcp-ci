import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import type { ModuleContext } from "../../../core/types.js";
import { textTool } from "../../../core/tool.js";
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

const ARTIFACT_FIELDS = ["Id", "Name", "Version", "Type", "Status", "DeployedBy", "DeployedOn"] as const;
const PAGE_SIZE = 100;
const SUMMARY_PAGE = 1000;
const SUMMARY_MAX_PAGES = 50;

/** Fields missing from the response (not selected) are left out; null shows as n/a. */
function formatArtifact(a: IntegrationRuntimeArtifact): string {
  return ARTIFACT_FIELDS.filter((field) => a[field] !== undefined)
    .map((field) => `${field}: ${field === "DeployedOn" ? parseODataDate(a.DeployedOn) : (a[field] ?? "n/a")}`)
    .join("\n");
}

function countBy(artifacts: IntegrationRuntimeArtifact[], field: "Status" | "Type"): string {
  const counts = new Map<string, number>();
  for (const a of artifacts) counts.set(a[field] ?? "n/a", (counts.get(a[field] ?? "n/a") ?? 0) + 1);
  return [...counts].sort((x, y) => y[1] - x[1]).map(([value, count]) => `  ${value}: ${count}`).join("\n");
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
        "List deployed runtime artifacts on the active SAP Cloud Integration tenant (100 per page by default). Use summary for counts by status and type instead of a full list.",
      inputSchema: z.object({
        summary: z
          .boolean()
          .optional()
          .describe("Only return counts by Status and Type over all artifacts (respects filter; ignores select, orderby, top, skip)"),
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
          .describe(`Maximum number of results to return (default ${PAGE_SIZE})`),
        skip: z
          .number()
          .optional()
          .describe("Number of results to skip (for pagination)"),
      }),
    },
    textTool(async ({ summary, filter, select, orderby, top, skip }) => {
      if (summary) {
        // getCollection returns one server page, and the server may cap it
        // below $top, so keep paging until a page comes back short.
        const all: IntegrationRuntimeArtifact[] = [];
        let pageLength = 0;
        for (let page = 0; page < SUMMARY_MAX_PAGES; page++) {
          const rows =
            await context.odataClient.getCollection<IntegrationRuntimeArtifact>(
              buildRuntimeArtifactsPath(),
              { $filter: filter, $select: "Status,Type", $top: SUMMARY_PAGE, $skip: all.length }
            );
          all.push(...rows);
          if (page === 0) pageLength = rows.length;
          if (rows.length === 0 || rows.length < pageLength) break;
        }
        if (all.length === 0) return "No deployed artifacts found.";
        return `${all.length} artifact(s)\n\nBy status:\n${countBy(all, "Status")}\n\nBy type:\n${countBy(all, "Type")}`;
      }
      const pageSize = top ?? PAGE_SIZE;
      const start = skip ?? 0;
      const artifacts =
        await context.odataClient.getCollection<IntegrationRuntimeArtifact>(
          buildRuntimeArtifactsPath(),
          {
            $filter: filter,
            $select: select,
            $orderby: orderby,
            $top: pageSize,
            $skip: skip,
          }
        );
      if (artifacts.length === 0) {
        return "No deployed artifacts found.";
      }
      const text = artifacts.map(formatArtifact).join("\n\n");
      return artifacts.length < pageSize
        ? text
        : `${text}\n\nShowing ${artifacts.length} artifacts starting at ${start}; more may exist, use skip: ${start + artifacts.length}.`;
    })
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
    textTool(async ({ id }) => {
      const artifact =
        await context.odataClient.getEntity<IntegrationRuntimeArtifact>(
          buildRuntimeArtifactPath(id)
        );
      const text = formatArtifact(artifact);
      return text;
    })
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
    textTool(async ({ filter }) => {
      const path = filter
        ? `${buildRuntimeArtifactsCountPath()}?$filter=${encodeURIComponent(filter)}`
        : buildRuntimeArtifactsCountPath();
      const count = await context.odataClient.getValue(path);
      return count;
    })
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
    textTool(async ({ id }) => {
      const errorText = await context.odataClient.getValue(
        buildRuntimeArtifactErrorPath(id)
      );
      if (!errorText) {
        return "No error information available.";
      }
      return errorText;
    })
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
    textTool(async ({ id, confirm }) => {
      if (!confirm) {
        const artifact =
          await context.odataClient.getEntity<IntegrationRuntimeArtifact>(
            buildRuntimeArtifactPath(id)
          );
        const preview = formatArtifact(artifact);
        return `Artifact to undeploy:\n\n${preview}\n\nSet confirm to true to proceed.`;
      }
      await context.odataClient.delete(buildRuntimeArtifactPath(id));
      return `Artifact '${id}' undeployed successfully.`;
    })
  );
}

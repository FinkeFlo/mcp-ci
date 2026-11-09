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

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const asText = (value: unknown) => (typeof value === "string" ? value : JSON.stringify(value));
const asList = (value: unknown): unknown[] => (Array.isArray(value) ? value : value === undefined ? [] : [value]);

/**
 * Turns the deployment error envelope (`message` plus `parameter[]` holding
 * JSON inside strings, nested through `childMessageInstances`) into readable
 * lines with the deepest message as root cause. Anything of another shape is
 * kept as text. Returns undefined when the envelope itself is not recognized,
 * so the caller can fall back to the raw text.
 */
function flattenArtifactError(text: string): string | undefined {
  const envelope = parseJson(text);
  if (!isObject(envelope) || !isObject(envelope.message) || !Array.isArray(envelope.parameter)) return undefined;
  const { messageId, subsystemName, subsytemPartName, messageText } = envelope.message;
  const lines = [`Error: ${messageId ?? "unknown"} (${[subsystemName, subsytemPartName].filter(Boolean).join(" / ")})`];
  if (messageText) lines.push(asText(messageText));
  let root: { depth: number; line: string } | undefined;
  const walk = (detail: Record<string, unknown>, depth: number) => {
    const line = [detail.message === undefined ? undefined : asText(detail.message), asList(detail.parameters).map(asText).join("; ")]
      .filter(Boolean)
      .join(": ");
    if (line) {
      lines.push(`${"  ".repeat(depth)}- ${line}`);
      if (!root || depth > root.depth) root = { depth, line };
    }
    for (const child of asList(detail.childMessageInstances)) {
      if (isObject(child)) walk(child, depth + 1);
      else if (child !== null) lines.push(`${"  ".repeat(depth + 1)}- ${asText(child)}`);
    }
  };
  for (const entry of envelope.parameter) {
    const detail = typeof entry === "string" ? (parseJson(entry) ?? entry) : entry;
    if (isObject(detail) && ("message" in detail || "childMessageInstances" in detail)) walk(detail, 0);
    else lines.push(`- ${typeof entry === "string" ? entry : asText(entry)}`);
  }
  if (root) lines.push("", `Root cause: ${root.line}`);
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
    textTool(async ({ filter, select, orderby, top, skip }) => {
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
        return "No deployed artifacts found.";
      }
      const text = artifacts.map(formatArtifact).join("\n\n");
      return text;
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
      return flattenArtifactError(errorText) ?? errorText;
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

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type { ModuleContext } from "../../../core/types.js";
import type { DesignGuidelineExecutionResult } from "../types.js";
import { escapeOData } from "../../../core/odata-utils.js";
import {
  buildGuidelineResultsPath,
  buildGuidelineResultPath,
  buildGuidelineResultValuePath,
  buildExecuteGuidelinesPath,
} from "../queries.js";

function formatGuidelineResult(r: DesignGuidelineExecutionResult): string {
  const lines: string[] = [];
  lines.push(`ExecutionId: ${r.ExecutionId}`);
  lines.push(`ExecutionStatus: ${r.ExecutionStatus}`);
  lines.push(`ExecutionTime: ${r.ExecutionTime ?? "n/a"}`);
  lines.push(`GuidelineId: ${r.GuidelineId ?? "n/a"}`);
  lines.push(`GuidelineName: ${r.GuidelineName ?? "n/a"}`);
  lines.push(`Category: ${r.Category ?? "n/a"}`);
  lines.push(`Severity: ${r.Severity ?? "n/a"}`);
  lines.push(`Applicability: ${r.Applicability ?? "n/a"}`);
  lines.push(`Compliance: ${r.Compliance ?? "n/a"}`);
  return lines.join("\n");
}

const artifactTypeEnum = z.enum(["iflow", "script_collection"]);

export function registerDesignGuidelineTools(
  server: McpServer,
  context: ModuleContext
) {
  // 1. list_guideline_results
  // @api GET /IntegrationDesigntimeArtifacts(Id='{Id}',Version='{Version}')/DesignGuidelineExecutionResults
  // @api GET /ScriptCollectionDesigntimeArtifacts(Id='{Id}',Version='{Version}')/DesignGuidelineExecutionResults
  server.registerTool(
    "list_guideline_results",
    {
      description:
        "List design guideline execution results for an integration flow or script collection.",
      inputSchema: z.object({
        artifactId: z.string().describe("The artifact ID"),
        version: z
          .string()
          .optional()
          .describe("The artifact version (default: 'active')"),
        artifactType: artifactTypeEnum.describe(
          "The artifact type: 'iflow' or 'script_collection'"
        ),
      }),
    },
    async ({ artifactId, version, artifactType }) => {
      try {
        const results =
          await context.odataClient.getCollection<DesignGuidelineExecutionResult>(
            buildGuidelineResultsPath(
              artifactType,
              artifactId,
              version ?? "active"
            )
          );
        if (results.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: "No guideline execution results found.",
              },
            ],
          };
        }
        const text = results.map(formatGuidelineResult).join("\n\n");
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

  // 2. get_guideline_result
  // @api GET /IntegrationDesigntimeArtifacts(Id='{Id}',Version='{Version}')/DesignGuidelineExecutionResults('{ExecutionId}')
  // @api GET /ScriptCollectionDesigntimeArtifacts(Id='{Id}',Version='{Version}')/DesignGuidelineExecutionResults('{ExecutionId}')
  server.registerTool(
    "get_guideline_result",
    {
      description:
        "Get details of a specific design guideline execution result.",
      inputSchema: z.object({
        artifactId: z.string().describe("The artifact ID"),
        version: z.string().describe("The artifact version"),
        artifactType: artifactTypeEnum.describe(
          "The artifact type: 'iflow' or 'script_collection'"
        ),
        executionId: z.string().describe("The execution result ID"),
      }),
    },
    async ({ artifactId, version, artifactType, executionId }) => {
      try {
        const result =
          await context.odataClient.getEntity<DesignGuidelineExecutionResult>(
            buildGuidelineResultPath(
              artifactType,
              artifactId,
              version,
              executionId
            )
          );
        const text = formatGuidelineResult(result);
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

  // 3. execute_guidelines
  // @api POST /ExecuteIntegrationDesigntimeArtifactsGuidelines
  // @api POST /ExecuteScriptCollectionDesigntimeArtifactsGuidelines
  server.registerTool(
    "execute_guidelines",
    {
      description:
        "Execute design guidelines for an integration flow or script collection. Without confirm, shows a preview. Set confirm to true to execute.",
      inputSchema: z.object({
        artifactId: z.string().describe("The artifact ID"),
        version: z.string().describe("The artifact version"),
        artifactType: artifactTypeEnum.describe(
          "The artifact type: 'iflow' or 'script_collection'"
        ),
        confirm: z
          .boolean()
          .optional()
          .describe(
            "Set to true to actually execute the design guidelines"
          ),
      }),
    },
    async ({ artifactId, version, artifactType, confirm }) => {
      try {
        if (!confirm) {
          const lines: string[] = [];
          lines.push("Design guidelines to execute:");
          lines.push("");
          lines.push(`ArtifactId: ${artifactId}`);
          lines.push(`Version: ${version}`);
          lines.push(`ArtifactType: ${artifactType}`);
          lines.push("");
          lines.push("Set confirm to true to proceed.");
          return {
            content: [{ type: "text" as const, text: lines.join("\n") }],
          };
        }
        const path = `${buildExecuteGuidelinesPath(artifactType)}?Id='${escapeOData(artifactId)}'&Version='${escapeOData(version)}'`;
        await context.odataClient.post(path);
        return {
          content: [
            {
              type: "text" as const,
              text: `Design guidelines execution triggered successfully for artifact '${artifactId}'.`,
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

  // 4. download_guideline_result
  // @api GET /IntegrationDesigntimeArtifacts(Id='{Id}',Version='{Version}')/DesignGuidelineExecutionResults('{ExecutionId}')/$value
  server.registerTool(
    "download_guideline_result",
    {
      description:
        "Download the detailed result of a design guideline execution. Available for integration flows only.",
      inputSchema: z.object({
        artifactId: z.string().describe("The artifact ID"),
        version: z.string().describe("The artifact version"),
        executionId: z.string().describe("The execution result ID"),
      }),
    },
    async ({ artifactId, version, executionId }) => {
      try {
        const content = await context.odataClient.getValue(
          buildGuidelineResultValuePath(artifactId, version, executionId)
        );
        const MAX_SIZE = 100 * 1024; // 100KB
        if (content.length > MAX_SIZE) {
          const truncated = content.slice(0, MAX_SIZE);
          return {
            content: [
              {
                type: "text" as const,
                text: `${truncated}\n\n--- TRUNCATED: Content exceeds 100KB (${content.length} bytes total). Only the first 100KB is shown. ---`,
              },
            ],
          };
        }
        return {
          content: [{ type: "text" as const, text: content }],
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

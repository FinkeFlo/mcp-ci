import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import type { ModuleContext } from "../../../core/types.js";
import { textTool } from "../../../core/tool.js";
import type { ScriptCollectionDesigntimeArtifact } from "../types.js";
import { escapeOData } from "../../../core/odata-utils.js";
import {
  buildPackageScriptCollectionsPath,
  buildScriptCollectionPath,
  buildScriptCollectionValuePath,
  buildDeployScriptCollectionPath,
  buildSaveScriptCollectionVersionPath,
} from "../queries.js";

function formatScriptCollectionSummary(
  sc: ScriptCollectionDesigntimeArtifact
): string {
  const lines: string[] = [];
  lines.push(`Id: ${sc.Id ?? "n/a"}`);
  lines.push(`Name: ${sc.Name ?? "n/a"}`);
  lines.push(`Version: ${sc.Version ?? "n/a"}`);
  lines.push(`PackageId: ${sc.PackageId ?? "n/a"}`);
  lines.push(`Description: ${sc.Description ?? "n/a"}`);
  return lines.join("\n");
}

export function registerScriptCollectionTools(
  server: McpServer,
  context: ModuleContext
) {
  // 1. list_script_collections
  // @api GET /IntegrationPackages('{Id}')/ScriptCollectionDesigntimeArtifacts
  server.registerTool(
    "list_script_collections",
    {
      description:
        "List script collection designtime artifacts for a specific integration package.",
      inputSchema: z.object({
        packageId: z.string().describe("The integration package ID"),
      }),
    },
    textTool(async ({ packageId }) => {
      const collections =
        await context.odataClient.getCollection<ScriptCollectionDesigntimeArtifact>(
          buildPackageScriptCollectionsPath(packageId)
        );
      if (collections.length === 0) {
        return "No script collections found.";
      }
      const text = collections
        .map(formatScriptCollectionSummary)
        .join("\n\n");
      return text;
    })
  );

  // 2. get_script_collection
  // @api GET /ScriptCollectionDesigntimeArtifacts(Id='{Id}',Version='{Version}')
  server.registerTool(
    "get_script_collection",
    {
      description:
        "Get details of a specific script collection designtime artifact by its ID.",
      inputSchema: z.object({
        id: z.string().describe("The script collection artifact ID"),
        version: z
          .string()
          .optional()
          .describe("The artifact version (default: 'active')"),
      }),
    },
    textTool(async ({ id, version }) => {
      const sc =
        await context.odataClient.getEntity<ScriptCollectionDesigntimeArtifact>(
          buildScriptCollectionPath(id, version ?? "active")
        );
      const text = formatScriptCollectionSummary(sc);
      return text;
    })
  );

  // 3. create_script_collection
  // @api POST /ScriptCollectionDesigntimeArtifacts
  server.registerTool(
    "create_script_collection",
    {
      description:
        "Create a new script collection designtime artifact. Without confirm, shows a preview. Set confirm to true to execute.",
      inputSchema: z.object({
        id: z.string().describe("The script collection ID"),
        name: z.string().describe("The script collection name"),
        packageId: z.string().describe("The integration package ID"),
        description: z
          .string()
          .optional()
          .describe("Description of the script collection"),
        artifactContent: z
          .string()
          .optional()
          .describe("Base64-encoded artifact content"),
        confirm: z
          .boolean()
          .optional()
          .describe("Set to true to actually create the script collection"),
      }),
    },
    textTool(async ({ id, name, packageId, description, artifactContent, confirm }) => {
      if (!confirm) {
        const lines: string[] = [];
        lines.push("Script collection to create:");
        lines.push("");
        lines.push(`Id: ${id}`);
        lines.push(`Name: ${name}`);
        lines.push(`PackageId: ${packageId}`);
        lines.push(`Description: ${description ?? "n/a"}`);
        lines.push(
          `ArtifactContent: ${artifactContent ? "(provided)" : "n/a"}`
        );
        lines.push("");
        lines.push("Set confirm to true to proceed.");
        return lines.join("\n");
      }
      const body: Record<string, unknown> = {
        Id: id,
        Name: name,
        PackageId: packageId,
      };
      if (description !== undefined) body.Description = description;
      if (artifactContent !== undefined)
        body.ArtifactContent = artifactContent;
      await context.odataClient.post(
        "/api/v1/ScriptCollectionDesigntimeArtifacts",
        body
      );
      return `Script collection '${id}' created successfully.`;
    })
  );

  // 4. update_script_collection
  // @api GET /ScriptCollectionDesigntimeArtifacts(Id='{Id}',Version='{Version}')
  // @api PUT /ScriptCollectionDesigntimeArtifacts(Id='{Id}',Version='{Version}')
  server.registerTool(
    "update_script_collection",
    {
      description:
        "Update an existing script collection designtime artifact. Without confirm, shows a preview. Set confirm to true to execute.",
      inputSchema: z.object({
        id: z.string().describe("The script collection ID"),
        version: z.string().describe("The artifact version"),
        name: z.string().optional().describe("New script collection name"),
        description: z
          .string()
          .optional()
          .describe("New description"),
        artifactContent: z
          .string()
          .optional()
          .describe("New base64-encoded artifact content"),
        confirm: z
          .boolean()
          .optional()
          .describe("Set to true to actually update the script collection"),
      }),
    },
    textTool(async ({ id, version, name, description, artifactContent, confirm }) => {
      if (!confirm) {
        const sc =
          await context.odataClient.getEntity<ScriptCollectionDesigntimeArtifact>(
            buildScriptCollectionPath(id, version)
          );
        const lines: string[] = [];
        lines.push("Script collection to update:");
        lines.push("");
        lines.push(formatScriptCollectionSummary(sc));
        lines.push("");
        lines.push("Proposed changes:");
        if (name !== undefined)
          lines.push(`  Name: ${sc.Name} -> ${name}`);
        if (description !== undefined)
          lines.push(`  Description: ${sc.Description} -> ${description}`);
        if (artifactContent !== undefined)
          lines.push(`  ArtifactContent: (new content provided)`);
        lines.push("");
        lines.push("Set confirm to true to proceed.");
        return lines.join("\n");
      }
      const body: Record<string, unknown> = {};
      if (name !== undefined) body.Name = name;
      if (description !== undefined) body.Description = description;
      if (artifactContent !== undefined)
        body.ArtifactContent = artifactContent;
      await context.odataClient.put(
        buildScriptCollectionPath(id, version),
        body
      );
      return `Script collection '${id}' updated successfully.`;
    })
  );

  // 5. delete_script_collection
  // @api GET /ScriptCollectionDesigntimeArtifacts(Id='{Id}',Version='{Version}')
  // @api DELETE /ScriptCollectionDesigntimeArtifacts(Id='{Id}',Version='{Version}')
  server.registerTool(
    "delete_script_collection",
    {
      description:
        "Delete a script collection designtime artifact. Without confirm, shows a preview. Set confirm to true to execute.",
      inputSchema: z.object({
        id: z.string().describe("The script collection ID"),
        version: z.string().describe("The artifact version"),
        confirm: z
          .boolean()
          .optional()
          .describe("Set to true to actually delete the script collection"),
      }),
    },
    textTool(async ({ id, version, confirm }) => {
      if (!confirm) {
        const sc =
          await context.odataClient.getEntity<ScriptCollectionDesigntimeArtifact>(
            buildScriptCollectionPath(id, version)
          );
        const preview = formatScriptCollectionSummary(sc);
        return `Script collection to delete:\n\n${preview}\n\nSet confirm to true to proceed.`;
      }
      await context.odataClient.delete(
        buildScriptCollectionPath(id, version)
      );
      return `Script collection '${id}' deleted successfully.`;
    })
  );

  // 6. deploy_script_collection
  // @api POST /DeployScriptCollectionDesigntimeArtifact
  server.registerTool(
    "deploy_script_collection",
    {
      description:
        "Deploy a script collection designtime artifact. Without confirm, shows a preview. Set confirm to true to execute.",
      inputSchema: z.object({
        id: z.string().describe("The script collection ID"),
        version: z.string().describe("The artifact version"),
        confirm: z
          .boolean()
          .optional()
          .describe("Set to true to actually deploy the script collection"),
      }),
    },
    textTool(async ({ id, version, confirm }) => {
      if (!confirm) {
        const lines: string[] = [];
        lines.push("Script collection to deploy:");
        lines.push("");
        lines.push(`Id: ${id}`);
        lines.push(`Version: ${version}`);
        lines.push("");
        lines.push("Set confirm to true to proceed.");
        return lines.join("\n");
      }
      const path = `${buildDeployScriptCollectionPath()}?Id='${escapeOData(id)}'&Version='${escapeOData(version)}'`;
      await context.odataClient.post(path);
      return `Script collection '${id}' deployment triggered successfully.`;
    })
  );

  // 7. save_script_collection_version
  // @api POST /ScriptCollectionDesigntimeArtifactSaveAsVersion
  server.registerTool(
    "save_script_collection_version",
    {
      description:
        "Save a new version of a script collection designtime artifact. Without confirm, shows a preview. Set confirm to true to execute.",
      inputSchema: z.object({
        id: z.string().describe("The script collection ID"),
        version: z.string().describe("The current artifact version"),
        newVersion: z
          .string()
          .describe("The new version to save as, e.g. '1.0.1'"),
        confirm: z
          .boolean()
          .optional()
          .describe("Set to true to actually save the new version"),
      }),
    },
    textTool(async ({ id, version, newVersion, confirm }) => {
      if (!confirm) {
        const lines: string[] = [];
        lines.push("Script collection version to save:");
        lines.push("");
        lines.push(`Id: ${id}`);
        lines.push(`Current Version: ${version}`);
        lines.push(`New Version: ${newVersion}`);
        lines.push("");
        lines.push("Set confirm to true to proceed.");
        return lines.join("\n");
      }
      const path = `${buildSaveScriptCollectionVersionPath()}?Id='${escapeOData(id)}'&Version='${escapeOData(version)}'&SaveAsVersion='${escapeOData(newVersion)}'`;
      await context.odataClient.post(path);
      return `Script collection '${id}' saved as version '${newVersion}' successfully.`;
    })
  );

  // 8. download_script_collection
  // @api GET /ScriptCollectionDesigntimeArtifacts(Id='{Id}',Version='{Version}')/$value
  server.registerTool(
    "download_script_collection",
    {
      description:
        "Download a script collection designtime artifact as a ZIP file.",
      inputSchema: z.object({
        id: z.string().describe("The script collection ID"),
        version: z
          .string()
          .optional()
          .describe("The artifact version (default: 'active')"),
      }),
    },
    textTool(async ({ id, version }) => {
      const content = await context.odataClient.getValue(
        buildScriptCollectionValuePath(id, version ?? "active")
      );
      return `Script collection '${id}' downloaded successfully. Content length: ${content.length} bytes (binary ZIP data).`;
    })
  );
}

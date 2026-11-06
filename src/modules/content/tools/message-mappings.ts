import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import type { ModuleContext } from "../../../core/types.js";
import { textTool } from "../../../core/tool.js";
import type { MessageMappingDesigntimeArtifact } from "../types.js";
import { escapeOData } from "../../../core/odata-utils.js";
import {
  buildMessageMappingsPath,
  buildMessageMappingPath,
  buildMessageMappingValuePath,
  buildDeployMessageMappingPath,
  buildSaveMessageMappingVersionPath,
} from "../queries.js";

function formatMessageMappingSummary(
  mm: MessageMappingDesigntimeArtifact
): string {
  const lines: string[] = [];
  lines.push(`Id: ${mm.Id ?? "n/a"}`);
  lines.push(`Name: ${mm.Name ?? "n/a"}`);
  lines.push(`Version: ${mm.Version ?? "n/a"}`);
  lines.push(`PackageId: ${mm.PackageId ?? "n/a"}`);
  lines.push(`Description: ${mm.Description ?? "n/a"}`);
  return lines.join("\n");
}

export function registerMessageMappingTools(
  server: McpServer,
  context: ModuleContext
) {
  // 1. list_message_mappings
  // @api GET /MessageMappingDesigntimeArtifacts
  server.registerTool(
    "list_message_mappings",
    {
      description:
        "List message mapping designtime artifacts on the active SAP Cloud Integration tenant.",
      inputSchema: z.object({}),
    },
    textTool(async () => {
      const mappings =
        await context.odataClient.getCollection<MessageMappingDesigntimeArtifact>(
          buildMessageMappingsPath()
        );
      if (mappings.length === 0) {
        return "No message mappings found.";
      }
      const text = mappings.map(formatMessageMappingSummary).join("\n\n");
      return text;
    })
  );

  // 2. get_message_mapping
  // @api GET /MessageMappingDesigntimeArtifacts(Id='{Id}',Version='{Version}')
  server.registerTool(
    "get_message_mapping",
    {
      description:
        "Get details of a specific message mapping designtime artifact by its ID.",
      inputSchema: z.object({
        id: z.string().describe("The message mapping artifact ID"),
        version: z
          .string()
          .optional()
          .describe("The artifact version (default: 'active')"),
      }),
    },
    textTool(async ({ id, version }) => {
      const mm =
        await context.odataClient.getEntity<MessageMappingDesigntimeArtifact>(
          buildMessageMappingPath(id, version ?? "active")
        );
      const text = formatMessageMappingSummary(mm);
      return text;
    })
  );

  // 3. create_message_mapping
  // @api POST /MessageMappingDesigntimeArtifacts
  server.registerTool(
    "create_message_mapping",
    {
      description:
        "Create a new message mapping designtime artifact. Without confirm, shows a preview. Set confirm to true to execute.",
      inputSchema: z.object({
        id: z.string().describe("The message mapping ID"),
        name: z.string().describe("The message mapping name"),
        packageId: z.string().describe("The integration package ID"),
        description: z
          .string()
          .optional()
          .describe("Description of the message mapping"),
        artifactContent: z
          .string()
          .optional()
          .describe("Base64-encoded artifact content"),
        confirm: z
          .boolean()
          .optional()
          .describe("Set to true to actually create the message mapping"),
      }),
    },
    textTool(async ({ id, name, packageId, description, artifactContent, confirm }) => {
      if (!confirm) {
        const lines: string[] = [];
        lines.push("Message mapping to create:");
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
      await context.odataClient.post(buildMessageMappingsPath(), body);
      return `Message mapping '${id}' created successfully.`;
    })
  );

  // 4. update_message_mapping
  // @api GET /MessageMappingDesigntimeArtifacts(Id='{Id}',Version='{Version}')
  // @api PUT /MessageMappingDesigntimeArtifacts(Id='{Id}',Version='{Version}')
  server.registerTool(
    "update_message_mapping",
    {
      description:
        "Update an existing message mapping designtime artifact. Without confirm, shows a preview. Set confirm to true to execute.",
      inputSchema: z.object({
        id: z.string().describe("The message mapping ID"),
        version: z.string().describe("The artifact version"),
        name: z.string().optional().describe("New message mapping name"),
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
          .describe("Set to true to actually update the message mapping"),
      }),
    },
    textTool(async ({ id, version, name, description, artifactContent, confirm }) => {
      if (!confirm) {
        const mm =
          await context.odataClient.getEntity<MessageMappingDesigntimeArtifact>(
            buildMessageMappingPath(id, version)
          );
        const lines: string[] = [];
        lines.push("Message mapping to update:");
        lines.push("");
        lines.push(formatMessageMappingSummary(mm));
        lines.push("");
        lines.push("Proposed changes:");
        if (name !== undefined)
          lines.push(`  Name: ${mm.Name} -> ${name}`);
        if (description !== undefined)
          lines.push(`  Description: ${mm.Description} -> ${description}`);
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
        buildMessageMappingPath(id, version),
        body
      );
      return `Message mapping '${id}' updated successfully.`;
    })
  );

  // 5. delete_message_mapping
  // @api GET /MessageMappingDesigntimeArtifacts(Id='{Id}',Version='{Version}')
  // @api DELETE /MessageMappingDesigntimeArtifacts(Id='{Id}',Version='{Version}')
  server.registerTool(
    "delete_message_mapping",
    {
      description:
        "Delete a message mapping designtime artifact. Without confirm, shows a preview. Set confirm to true to execute.",
      inputSchema: z.object({
        id: z.string().describe("The message mapping ID"),
        version: z.string().describe("The artifact version"),
        confirm: z
          .boolean()
          .optional()
          .describe("Set to true to actually delete the message mapping"),
      }),
    },
    textTool(async ({ id, version, confirm }) => {
      if (!confirm) {
        const mm =
          await context.odataClient.getEntity<MessageMappingDesigntimeArtifact>(
            buildMessageMappingPath(id, version)
          );
        const preview = formatMessageMappingSummary(mm);
        return `Message mapping to delete:\n\n${preview}\n\nSet confirm to true to proceed.`;
      }
      await context.odataClient.delete(buildMessageMappingPath(id, version));
      return `Message mapping '${id}' deleted successfully.`;
    })
  );

  // 6. deploy_message_mapping
  // @api POST /DeployMessageMappingDesigntimeArtifact
  server.registerTool(
    "deploy_message_mapping",
    {
      description:
        "Deploy a message mapping designtime artifact. Without confirm, shows a preview. Set confirm to true to execute.",
      inputSchema: z.object({
        id: z.string().describe("The message mapping ID"),
        version: z.string().describe("The artifact version"),
        confirm: z
          .boolean()
          .optional()
          .describe("Set to true to actually deploy the message mapping"),
      }),
    },
    textTool(async ({ id, version, confirm }) => {
      if (!confirm) {
        const lines: string[] = [];
        lines.push("Message mapping to deploy:");
        lines.push("");
        lines.push(`Id: ${id}`);
        lines.push(`Version: ${version}`);
        lines.push("");
        lines.push("Set confirm to true to proceed.");
        return lines.join("\n");
      }
      const path = `${buildDeployMessageMappingPath()}?Id='${escapeOData(id)}'&Version='${escapeOData(version)}'`;
      await context.odataClient.post(path);
      return `Message mapping '${id}' deployment triggered successfully.`;
    })
  );

  // 7. save_message_mapping_version
  // @api POST /MessageMappingDesigntimeArtifactSaveAsVersion
  server.registerTool(
    "save_message_mapping_version",
    {
      description:
        "Save a new version of a message mapping designtime artifact. Without confirm, shows a preview. Set confirm to true to execute.",
      inputSchema: z.object({
        id: z.string().describe("The message mapping ID"),
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
        lines.push("Message mapping version to save:");
        lines.push("");
        lines.push(`Id: ${id}`);
        lines.push(`Current Version: ${version}`);
        lines.push(`New Version: ${newVersion}`);
        lines.push("");
        lines.push("Set confirm to true to proceed.");
        return lines.join("\n");
      }
      const path = `${buildSaveMessageMappingVersionPath()}?Id='${escapeOData(id)}'&Version='${escapeOData(version)}'&SaveAsVersion='${escapeOData(newVersion)}'`;
      await context.odataClient.post(path);
      return `Message mapping '${id}' saved as version '${newVersion}' successfully.`;
    })
  );

  // 8. download_message_mapping
  // @api GET /MessageMappingDesigntimeArtifacts(Id='{Id}',Version='{Version}')/$value
  server.registerTool(
    "download_message_mapping",
    {
      description:
        "Download a message mapping designtime artifact as a ZIP file.",
      inputSchema: z.object({
        id: z.string().describe("The message mapping ID"),
        version: z
          .string()
          .optional()
          .describe("The artifact version (default: 'active')"),
      }),
    },
    textTool(async ({ id, version }) => {
      const content = await context.odataClient.getValue(
        buildMessageMappingValuePath(id, version ?? "active")
      );
      return `Message mapping '${id}' downloaded successfully. Content length: ${content.length} bytes (binary ZIP data).`;
    })
  );
}

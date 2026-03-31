import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type { ModuleContext } from "../../../core/types.js";
import type {
  ValueMappingDesigntimeArtifact,
  ValMapSchema,
} from "../types.js";
import { escapeOData } from "../../../core/odata-utils.js";
import {
  buildValueMappingsPath,
  buildValueMappingPath,
  buildValueMappingValuePath,
  buildValueMappingSchemaPath,
  buildDeployValueMappingPath,
  buildSaveValueMappingVersionPath,
  buildUpsertValMapsPath,
  buildUpdateDefaultValMapPath,
  buildDeleteValMapsPath,
} from "../queries.js";

function formatValueMappingSummary(
  vm: ValueMappingDesigntimeArtifact
): string {
  const lines: string[] = [];
  lines.push(`Id: ${vm.Id ?? "n/a"}`);
  lines.push(`Name: ${vm.Name ?? "n/a"}`);
  lines.push(`Version: ${vm.Version ?? "n/a"}`);
  lines.push(`PackageId: ${vm.PackageId ?? "n/a"}`);
  lines.push(`Description: ${vm.Description ?? "n/a"}`);
  return lines.join("\n");
}

function formatValMapSchema(s: ValMapSchema): string {
  const lines: string[] = [];
  lines.push(`SrcAgency: ${s.SrcAgency ?? "n/a"}`);
  lines.push(`SrcId: ${s.SrcId ?? "n/a"}`);
  lines.push(`TgtAgency: ${s.TgtAgency ?? "n/a"}`);
  lines.push(`TgtId: ${s.TgtId ?? "n/a"}`);
  lines.push(`State: ${s.State ?? "n/a"}`);
  return lines.join("\n");
}

export function registerValueMappingTools(
  server: McpServer,
  context: ModuleContext
) {
  // 1. list_value_mappings
  server.registerTool(
    "list_value_mappings",
    {
      description:
        "List value mapping designtime artifacts on the active SAP Cloud Integration tenant.",
      inputSchema: z.object({}),
    },
    async () => {
      try {
        const mappings =
          await context.odataClient.getCollection<ValueMappingDesigntimeArtifact>(
            buildValueMappingsPath()
          );
        if (mappings.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: "No value mappings found.",
              },
            ],
          };
        }
        const text = mappings.map(formatValueMappingSummary).join("\n\n");
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

  // 2. get_value_mapping
  server.registerTool(
    "get_value_mapping",
    {
      description:
        "Get details of a specific value mapping designtime artifact by its ID.",
      inputSchema: z.object({
        id: z.string().describe("The value mapping artifact ID"),
        version: z
          .string()
          .optional()
          .describe("The artifact version (default: 'active')"),
      }),
    },
    async ({ id, version }) => {
      try {
        const vm =
          await context.odataClient.getEntity<ValueMappingDesigntimeArtifact>(
            buildValueMappingPath(id, version ?? "active")
          );
        const text = formatValueMappingSummary(vm);
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

  // 3. create_value_mapping
  server.registerTool(
    "create_value_mapping",
    {
      description:
        "Create a new value mapping designtime artifact. Without confirm, shows a preview. Set confirm to true to execute.",
      inputSchema: z.object({
        id: z.string().describe("The value mapping ID"),
        name: z.string().describe("The value mapping name"),
        packageId: z.string().describe("The integration package ID"),
        description: z
          .string()
          .optional()
          .describe("Description of the value mapping"),
        artifactContent: z
          .string()
          .optional()
          .describe("Base64-encoded artifact content"),
        confirm: z
          .boolean()
          .optional()
          .describe("Set to true to actually create the value mapping"),
      }),
    },
    async ({ id, name, packageId, description, artifactContent, confirm }) => {
      try {
        if (!confirm) {
          const lines: string[] = [];
          lines.push("Value mapping to create:");
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
          return {
            content: [{ type: "text" as const, text: lines.join("\n") }],
          };
        }
        const body: Record<string, unknown> = {
          Id: id,
          Name: name,
          PackageId: packageId,
        };
        if (description !== undefined) body.Description = description;
        if (artifactContent !== undefined)
          body.ArtifactContent = artifactContent;
        await context.odataClient.post(buildValueMappingsPath(), body);
        return {
          content: [
            {
              type: "text" as const,
              text: `Value mapping '${id}' created successfully.`,
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

  // 4. delete_value_mapping
  server.registerTool(
    "delete_value_mapping",
    {
      description:
        "Delete a value mapping designtime artifact. Without confirm, shows a preview. Set confirm to true to execute.",
      inputSchema: z.object({
        id: z.string().describe("The value mapping ID"),
        version: z.string().describe("The artifact version"),
        confirm: z
          .boolean()
          .optional()
          .describe("Set to true to actually delete the value mapping"),
      }),
    },
    async ({ id, version, confirm }) => {
      try {
        if (!confirm) {
          const vm =
            await context.odataClient.getEntity<ValueMappingDesigntimeArtifact>(
              buildValueMappingPath(id, version)
            );
          const preview = formatValueMappingSummary(vm);
          return {
            content: [
              {
                type: "text" as const,
                text: `Value mapping to delete:\n\n${preview}\n\nSet confirm to true to proceed.`,
              },
            ],
          };
        }
        await context.odataClient.delete(buildValueMappingPath(id, version));
        return {
          content: [
            {
              type: "text" as const,
              text: `Value mapping '${id}' deleted successfully.`,
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

  // 5. deploy_value_mapping
  server.registerTool(
    "deploy_value_mapping",
    {
      description:
        "Deploy a value mapping designtime artifact. Without confirm, shows a preview. Set confirm to true to execute.",
      inputSchema: z.object({
        id: z.string().describe("The value mapping ID"),
        version: z.string().describe("The artifact version"),
        confirm: z
          .boolean()
          .optional()
          .describe("Set to true to actually deploy the value mapping"),
      }),
    },
    async ({ id, version, confirm }) => {
      try {
        if (!confirm) {
          const lines: string[] = [];
          lines.push("Value mapping to deploy:");
          lines.push("");
          lines.push(`Id: ${id}`);
          lines.push(`Version: ${version}`);
          lines.push("");
          lines.push("Set confirm to true to proceed.");
          return {
            content: [{ type: "text" as const, text: lines.join("\n") }],
          };
        }
        const path = `${buildDeployValueMappingPath()}?Id='${escapeOData(id)}'&Version='${escapeOData(version)}'`;
        await context.odataClient.post(path);
        return {
          content: [
            {
              type: "text" as const,
              text: `Value mapping '${id}' deployment triggered successfully.`,
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

  // 6. save_value_mapping_version
  server.registerTool(
    "save_value_mapping_version",
    {
      description:
        "Save a new version of a value mapping designtime artifact. Without confirm, shows a preview. Set confirm to true to execute.",
      inputSchema: z.object({
        id: z.string().describe("The value mapping ID"),
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
    async ({ id, version, newVersion, confirm }) => {
      try {
        if (!confirm) {
          const lines: string[] = [];
          lines.push("Value mapping version to save:");
          lines.push("");
          lines.push(`Id: ${id}`);
          lines.push(`Current Version: ${version}`);
          lines.push(`New Version: ${newVersion}`);
          lines.push("");
          lines.push("Set confirm to true to proceed.");
          return {
            content: [{ type: "text" as const, text: lines.join("\n") }],
          };
        }
        const path = `${buildSaveValueMappingVersionPath()}?Id='${escapeOData(id)}'&Version='${escapeOData(version)}'&SaveAsVersion='${escapeOData(newVersion)}'`;
        await context.odataClient.post(path);
        return {
          content: [
            {
              type: "text" as const,
              text: `Value mapping '${id}' saved as version '${newVersion}' successfully.`,
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

  // 7. download_value_mapping
  server.registerTool(
    "download_value_mapping",
    {
      description:
        "Download a value mapping designtime artifact as a ZIP file.",
      inputSchema: z.object({
        id: z.string().describe("The value mapping ID"),
        version: z
          .string()
          .optional()
          .describe("The artifact version (default: 'active')"),
      }),
    },
    async ({ id, version }) => {
      try {
        const content = await context.odataClient.getValue(
          buildValueMappingValuePath(id, version ?? "active")
        );
        return {
          content: [
            {
              type: "text" as const,
              text: `Value mapping '${id}' downloaded successfully. Content length: ${content.length} bytes (binary ZIP data).`,
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

  // 8. get_value_mapping_schema
  server.registerTool(
    "get_value_mapping_schema",
    {
      description:
        "Get the value mapping schema (source/target agency and identifier pairs) of a value mapping artifact.",
      inputSchema: z.object({
        id: z.string().describe("The value mapping ID"),
        version: z
          .string()
          .optional()
          .describe("The artifact version (default: 'active')"),
        expand: z
          .string()
          .optional()
          .describe(
            "Navigation properties to expand: 'ValMaps', 'DefaultValMaps', or 'ValMaps,DefaultValMaps'"
          ),
      }),
    },
    async ({ id, version, expand }) => {
      try {
        const params: Record<string, unknown> = {};
        if (expand !== undefined) params.$expand = expand;
        const schemas =
          await context.odataClient.getCollection<ValMapSchema>(
            buildValueMappingSchemaPath(id, version ?? "active"),
            params
          );
        if (schemas.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: "No value mapping schemas found.",
              },
            ],
          };
        }
        const text = schemas.map(formatValMapSchema).join("\n\n");
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

  // 9. upsert_value_maps
  server.registerTool(
    "upsert_value_maps",
    {
      description:
        "Upsert value map entries. Without confirm, shows a preview. Set confirm to true to execute.",
      inputSchema: z.object({
        body: z
          .string()
          .describe("JSON payload for the upsert operation"),
        confirm: z
          .boolean()
          .optional()
          .describe("Set to true to actually execute the upsert"),
      }),
    },
    async ({ body, confirm }) => {
      try {
        if (!confirm) {
          const lines: string[] = [];
          lines.push("Value maps to upsert:");
          lines.push("");
          lines.push(body);
          lines.push("");
          lines.push("Set confirm to true to proceed.");
          return {
            content: [{ type: "text" as const, text: lines.join("\n") }],
          };
        }
        await context.odataClient.post(
          buildUpsertValMapsPath(),
          JSON.parse(body)
        );
        return {
          content: [
            {
              type: "text" as const,
              text: "Value maps upserted successfully.",
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

  // 10. update_default_value_map
  server.registerTool(
    "update_default_value_map",
    {
      description:
        "Update the default value map. Without confirm, shows a preview. Set confirm to true to execute.",
      inputSchema: z.object({
        body: z
          .string()
          .describe("JSON payload for the update operation"),
        confirm: z
          .boolean()
          .optional()
          .describe("Set to true to actually execute the update"),
      }),
    },
    async ({ body, confirm }) => {
      try {
        if (!confirm) {
          const lines: string[] = [];
          lines.push("Default value map to update:");
          lines.push("");
          lines.push(body);
          lines.push("");
          lines.push("Set confirm to true to proceed.");
          return {
            content: [{ type: "text" as const, text: lines.join("\n") }],
          };
        }
        await context.odataClient.post(
          buildUpdateDefaultValMapPath(),
          JSON.parse(body)
        );
        return {
          content: [
            {
              type: "text" as const,
              text: "Default value map updated successfully.",
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

  // 11. delete_value_maps
  server.registerTool(
    "delete_value_maps",
    {
      description:
        "Delete value map entries. Without confirm, shows a preview. Set confirm to true to execute.",
      inputSchema: z.object({
        body: z
          .string()
          .describe("JSON payload specifying which value maps to delete"),
        confirm: z
          .boolean()
          .optional()
          .describe("Set to true to actually execute the deletion"),
      }),
    },
    async ({ body, confirm }) => {
      try {
        if (!confirm) {
          const lines: string[] = [];
          lines.push("Value maps to delete:");
          lines.push("");
          lines.push(body);
          lines.push("");
          lines.push("Set confirm to true to proceed.");
          return {
            content: [{ type: "text" as const, text: lines.join("\n") }],
          };
        }
        await context.odataClient.post(
          buildDeleteValMapsPath(),
          JSON.parse(body)
        );
        return {
          content: [
            {
              type: "text" as const,
              text: "Value maps deleted successfully.",
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

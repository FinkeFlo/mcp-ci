import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type { ModuleContext } from "../../../core/types.js";
import type {
  IntegrationDesigntimeArtifact,
  MessageMappingDesigntimeArtifact,
  ValueMappingDesigntimeArtifact,
  ScriptCollectionDesigntimeArtifact,
  PackageCustomTag,
  MessageTypeDesigntimeArtifact,
  FaultMessageTypeDesigntimeArtifact,
  DataTypeDesigntimeArtifact,
  ServiceInterfaceDesigntimeArtifact,
} from "../types.js";
import {
  buildPackageDesigntimeArtifactPath,
  buildPackageMessageMappingsPath,
  buildPackageMessageMappingPath,
  buildPackageValueMappingsPath,
  buildPackageValueMappingPath,
  buildPackageScriptCollectionPath,
  buildPackageCustomTagsPath,
  buildPackageMessageTypesPath,
  buildPackageFaultMessageTypesPath,
  buildPackageDataTypesPath,
  buildPackageServiceInterfacesPath,
} from "../queries.js";

function formatArtifact(
  a: IntegrationDesigntimeArtifact | MessageMappingDesigntimeArtifact | ScriptCollectionDesigntimeArtifact
): string {
  const lines: string[] = [];
  lines.push(`Id: ${a.Id ?? "n/a"}`);
  lines.push(`Name: ${a.Name ?? "n/a"}`);
  lines.push(`Version: ${a.Version ?? "n/a"}`);
  lines.push(`PackageId: ${a.PackageId ?? "n/a"}`);
  lines.push(`Description: ${a.Description ?? "n/a"}`);
  return lines.join("\n");
}

function formatValueMapping(vm: ValueMappingDesigntimeArtifact): string {
  const lines: string[] = [];
  lines.push(`Id: ${vm.Id ?? "n/a"}`);
  lines.push(`Name: ${vm.Name ?? "n/a"}`);
  lines.push(`Version: ${vm.Version ?? "n/a"}`);
  lines.push(`PackageId: ${vm.PackageId ?? "n/a"}`);
  lines.push(`Description: ${vm.Description ?? "n/a"}`);
  return lines.join("\n");
}

function formatCustomTag(tag: PackageCustomTag): string {
  return `Name: ${tag.Name ?? "n/a"}\nValue: ${tag.Value ?? "n/a"}`;
}

type TypeArtifact =
  | MessageTypeDesigntimeArtifact
  | FaultMessageTypeDesigntimeArtifact
  | DataTypeDesigntimeArtifact
  | ServiceInterfaceDesigntimeArtifact;

function formatTypeArtifact(a: TypeArtifact): string {
  const lines: string[] = [];
  lines.push(`Id: ${a.Id ?? "n/a"}`);
  lines.push(`Name: ${a.Name ?? "n/a"}`);
  lines.push(`Version: ${a.Version ?? "n/a"}`);
  lines.push(`PackageId: ${a.PackageId ?? "n/a"}`);
  lines.push(`Namespace: ${a.Namespace ?? "n/a"}`);
  lines.push(`Description: ${a.Description ?? "n/a"}`);
  return lines.join("\n");
}

export function registerPackageArtifactTools(
  server: McpServer,
  context: ModuleContext
) {
  // 1. get_package_designtime_artifact
  // @api GET /IntegrationPackages('{Id}')/IntegrationDesigntimeArtifacts(Id='{ArtifactId}',Version='{ArtifactVersion}')
  server.registerTool(
    "get_package_designtime_artifact",
    {
      description:
        "Get a specific integration flow within an integration package by package ID, artifact ID, and version.",
      inputSchema: z.object({
        packageId: z.string().describe("The integration package ID"),
        artifactId: z.string().describe("The integration flow artifact ID"),
        version: z
          .string()
          .optional()
          .describe("The artifact version (default: 'active')"),
      }),
    },
    async ({ packageId, artifactId, version }) => {
      try {
        const artifact =
          await context.odataClient.getEntity<IntegrationDesigntimeArtifact>(
            buildPackageDesigntimeArtifactPath(packageId, artifactId, version ?? "active")
          );
        return {
          content: [{ type: "text" as const, text: formatArtifact(artifact) }],
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

  // 2. list_package_message_mappings
  // @api GET /IntegrationPackages('{Id}')/MessageMappingDesigntimeArtifacts
  server.registerTool(
    "list_package_message_mappings",
    {
      description:
        "List message mapping designtime artifacts within a specific integration package.",
      inputSchema: z.object({
        packageId: z.string().describe("The integration package ID"),
      }),
    },
    async ({ packageId }) => {
      try {
        const mappings =
          await context.odataClient.getCollection<MessageMappingDesigntimeArtifact>(
            buildPackageMessageMappingsPath(packageId)
          );
        if (mappings.length === 0) {
          return {
            content: [
              { type: "text" as const, text: "No message mappings found." },
            ],
          };
        }
        const text = mappings.map(formatArtifact).join("\n\n");
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

  // 3. get_package_message_mapping
  // @api GET /IntegrationPackages('{Id}')/MessageMappingDesigntimeArtifacts(Id='{ArtifactId}',Version='{ArtifactVersion}')
  server.registerTool(
    "get_package_message_mapping",
    {
      description:
        "Get a specific message mapping within an integration package by package ID, artifact ID, and version.",
      inputSchema: z.object({
        packageId: z.string().describe("The integration package ID"),
        artifactId: z.string().describe("The message mapping artifact ID"),
        version: z
          .string()
          .optional()
          .describe("The artifact version (default: 'active')"),
      }),
    },
    async ({ packageId, artifactId, version }) => {
      try {
        const mapping =
          await context.odataClient.getEntity<MessageMappingDesigntimeArtifact>(
            buildPackageMessageMappingPath(packageId, artifactId, version ?? "active")
          );
        return {
          content: [{ type: "text" as const, text: formatArtifact(mapping) }],
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

  // 4. list_package_value_mappings
  // @api GET /IntegrationPackages('{Id}')/ValueMappingDesigntimeArtifacts
  server.registerTool(
    "list_package_value_mappings",
    {
      description:
        "List value mapping designtime artifacts within a specific integration package.",
      inputSchema: z.object({
        packageId: z.string().describe("The integration package ID"),
      }),
    },
    async ({ packageId }) => {
      try {
        const mappings =
          await context.odataClient.getCollection<ValueMappingDesigntimeArtifact>(
            buildPackageValueMappingsPath(packageId)
          );
        if (mappings.length === 0) {
          return {
            content: [
              { type: "text" as const, text: "No value mappings found." },
            ],
          };
        }
        const text = mappings.map(formatValueMapping).join("\n\n");
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

  // 5. get_package_value_mapping
  // @api GET /IntegrationPackages('{Id}')/ValueMappingDesigntimeArtifacts(Id='{ArtifactId}',Version='{ArtifactVersion}')
  server.registerTool(
    "get_package_value_mapping",
    {
      description:
        "Get a specific value mapping within an integration package by package ID, artifact ID, and version.",
      inputSchema: z.object({
        packageId: z.string().describe("The integration package ID"),
        artifactId: z.string().describe("The value mapping artifact ID"),
        version: z
          .string()
          .optional()
          .describe("The artifact version (default: 'active')"),
      }),
    },
    async ({ packageId, artifactId, version }) => {
      try {
        const mapping =
          await context.odataClient.getEntity<ValueMappingDesigntimeArtifact>(
            buildPackageValueMappingPath(packageId, artifactId, version ?? "active")
          );
        return {
          content: [{ type: "text" as const, text: formatValueMapping(mapping) }],
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

  // 6. get_package_script_collection
  // @api GET /IntegrationPackages('{Id}')/ScriptCollectionDesigntimeArtifacts(Id='{ScriptCollectionArtifactID}',Version='{ArtifactVersion}')
  server.registerTool(
    "get_package_script_collection",
    {
      description:
        "Get a specific script collection within an integration package by package ID, artifact ID, and version.",
      inputSchema: z.object({
        packageId: z.string().describe("The integration package ID"),
        artifactId: z.string().describe("The script collection artifact ID"),
        version: z
          .string()
          .optional()
          .describe("The artifact version (default: 'active')"),
      }),
    },
    async ({ packageId, artifactId, version }) => {
      try {
        const artifact =
          await context.odataClient.getEntity<ScriptCollectionDesigntimeArtifact>(
            buildPackageScriptCollectionPath(packageId, artifactId, version ?? "active")
          );
        return {
          content: [{ type: "text" as const, text: formatArtifact(artifact) }],
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

  // 7. get_package_custom_tags
  // @api GET /IntegrationPackages('{Id}')/CustomTags
  server.registerTool(
    "get_package_custom_tags",
    {
      description:
        "Get the custom tags assigned to a specific integration package.",
      inputSchema: z.object({
        packageId: z.string().describe("The integration package ID"),
      }),
    },
    async ({ packageId }) => {
      try {
        const tags =
          await context.odataClient.getCollection<PackageCustomTag>(
            buildPackageCustomTagsPath(packageId)
          );
        if (tags.length === 0) {
          return {
            content: [
              { type: "text" as const, text: "No custom tags found." },
            ],
          };
        }
        const text = tags.map(formatCustomTag).join("\n\n");
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

  // 8. list_package_message_types
  // @api GET /IntegrationPackages('{Id}')/MessageTypeDesigntimeArtifacts
  server.registerTool(
    "list_package_message_types",
    {
      description:
        "List message type designtime artifacts within a specific integration package.",
      inputSchema: z.object({
        packageId: z.string().describe("The integration package ID"),
      }),
    },
    async ({ packageId }) => {
      try {
        const artifacts =
          await context.odataClient.getCollection<MessageTypeDesigntimeArtifact>(
            buildPackageMessageTypesPath(packageId)
          );
        if (artifacts.length === 0) {
          return {
            content: [
              { type: "text" as const, text: "No message types found." },
            ],
          };
        }
        const text = artifacts.map(formatTypeArtifact).join("\n\n");
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

  // 9. list_package_fault_message_types
  // @api GET /IntegrationPackages('{Id}')/FaultMessageTypeDesigntimeArtifacts
  server.registerTool(
    "list_package_fault_message_types",
    {
      description:
        "List fault message type designtime artifacts within a specific integration package.",
      inputSchema: z.object({
        packageId: z.string().describe("The integration package ID"),
      }),
    },
    async ({ packageId }) => {
      try {
        const artifacts =
          await context.odataClient.getCollection<FaultMessageTypeDesigntimeArtifact>(
            buildPackageFaultMessageTypesPath(packageId)
          );
        if (artifacts.length === 0) {
          return {
            content: [
              { type: "text" as const, text: "No fault message types found." },
            ],
          };
        }
        const text = artifacts.map(formatTypeArtifact).join("\n\n");
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

  // 10. list_package_data_types
  // @api GET /IntegrationPackages('{Id}')/DataTypeDesigntimeArtifacts
  server.registerTool(
    "list_package_data_types",
    {
      description:
        "List data type designtime artifacts within a specific integration package.",
      inputSchema: z.object({
        packageId: z.string().describe("The integration package ID"),
      }),
    },
    async ({ packageId }) => {
      try {
        const artifacts =
          await context.odataClient.getCollection<DataTypeDesigntimeArtifact>(
            buildPackageDataTypesPath(packageId)
          );
        if (artifacts.length === 0) {
          return {
            content: [
              { type: "text" as const, text: "No data types found." },
            ],
          };
        }
        const text = artifacts.map(formatTypeArtifact).join("\n\n");
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

  // 11. list_package_service_interfaces
  // @api GET /IntegrationPackages('{Id}')/ServiceInterfaceDesigntimeArtifacts
  server.registerTool(
    "list_package_service_interfaces",
    {
      description:
        "List service interface designtime artifacts within a specific integration package.",
      inputSchema: z.object({
        packageId: z.string().describe("The integration package ID"),
      }),
    },
    async ({ packageId }) => {
      try {
        const artifacts =
          await context.odataClient.getCollection<ServiceInterfaceDesigntimeArtifact>(
            buildPackageServiceInterfacesPath(packageId)
          );
        if (artifacts.length === 0) {
          return {
            content: [
              { type: "text" as const, text: "No service interfaces found." },
            ],
          };
        }
        const text = artifacts.map(formatTypeArtifact).join("\n\n");
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

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type { ModuleContext } from "../../../core/types.js";
import type {
  IntegrationDesigntimeArtifact,
  Configuration,
  Resource,
} from "../types.js";
import { escapeOData } from "../../../core/odata-utils.js";
import {
  buildPackageDesigntimeArtifactsPath,
  buildDesigntimeArtifactsPath,
  buildDesigntimeArtifactPath,
  buildDesigntimeArtifactValuePath,
  buildDeployDesigntimeArtifactPath,
  buildValidateDesigntimeArtifactPath,
  buildSaveDesigntimeArtifactVersionPath,
  buildConfigurationsPath,
  buildConfigurationLinkPath,
  buildConfigurationsCountPath,
  buildResourcesPath,
  buildResourcePath,
  buildResourceValuePath,
  buildResourcesCountPath,
} from "../queries.js";

function formatArtifact(a: IntegrationDesigntimeArtifact): string {
  const lines: string[] = [];
  lines.push(`Id: ${a.Id ?? "n/a"}`);
  lines.push(`Name: ${a.Name ?? "n/a"}`);
  lines.push(`Version: ${a.Version ?? "n/a"}`);
  lines.push(`PackageId: ${a.PackageId ?? "n/a"}`);
  lines.push(`Description: ${a.Description ?? "n/a"}`);
  return lines.join("\n");
}

function formatConfiguration(c: Configuration): string {
  const lines: string[] = [];
  lines.push(`ParameterKey: ${c.ParameterKey}`);
  lines.push(`ParameterValue: ${c.ParameterValue}`);
  lines.push(`DataType: ${c.DataType}`);
  return lines.join("\n");
}

function formatResource(r: Resource): string {
  const lines: string[] = [];
  lines.push(`Name: ${r.Name}`);
  lines.push(`ResourceType: ${r.ResourceType}`);
  return lines.join("\n");
}

function formatResourceDetail(r: Resource): string {
  const lines: string[] = [];
  lines.push(`Name: ${r.Name}`);
  lines.push(`ResourceType: ${r.ResourceType}`);
  lines.push(`ReferencedResourceType: ${r.ReferencedResourceType ?? "n/a"}`);
  lines.push(`ResourceContent: ${r.ResourceContent ?? "n/a"}`);
  return lines.join("\n");
}

export function registerFlowTools(server: McpServer, context: ModuleContext) {
  // 1. list_designtime_artifacts
  // @api GET /IntegrationPackages('{Id}')/IntegrationDesigntimeArtifacts
  server.registerTool(
    "list_designtime_artifacts",
    {
      description:
        "List integration designtime artifacts (iFlows) in a specific integration package.",
      inputSchema: z.object({
        packageId: z.string().describe("The integration package ID"),
      }),
    },
    async ({ packageId }) => {
      try {
        const artifacts =
          await context.odataClient.getCollection<IntegrationDesigntimeArtifact>(
            buildPackageDesigntimeArtifactsPath(packageId)
          );
        if (artifacts.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: "No designtime artifacts found.",
              },
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

  // 2. get_designtime_artifact
  // @api GET /IntegrationDesigntimeArtifacts(Id='{Id}',Version='{Version}')
  server.registerTool(
    "get_designtime_artifact",
    {
      description:
        "Get details of a specific integration designtime artifact by its ID.",
      inputSchema: z.object({
        id: z.string().describe("The artifact ID"),
        version: z
          .string()
          .optional()
          .describe("The artifact version (default: 'active')"),
      }),
    },
    async ({ id, version }) => {
      try {
        const artifact =
          await context.odataClient.getEntity<IntegrationDesigntimeArtifact>(
            buildDesigntimeArtifactPath(id, version ?? "active")
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

  // 3. create_designtime_artifact
  // @api POST /IntegrationDesigntimeArtifacts
  server.registerTool(
    "create_designtime_artifact",
    {
      description:
        "Create a new integration designtime artifact. Without confirm, shows a preview. Set confirm to true to execute.",
      inputSchema: z.object({
        id: z.string().describe("The artifact ID"),
        name: z.string().describe("The artifact name"),
        packageId: z.string().describe("The integration package ID"),
        artifactContent: z
          .string()
          .optional()
          .describe("Base64-encoded artifact content"),
        confirm: z
          .boolean()
          .optional()
          .describe("Set to true to actually create the artifact"),
      }),
    },
    async ({ id, name, packageId, artifactContent, confirm }) => {
      try {
        if (!confirm) {
          const lines: string[] = [];
          lines.push("Artifact to create:");
          lines.push("");
          lines.push(`Id: ${id}`);
          lines.push(`Name: ${name}`);
          lines.push(`PackageId: ${packageId}`);
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
        if (artifactContent !== undefined)
          body.ArtifactContent = artifactContent;
        await context.odataClient.post(buildDesigntimeArtifactsPath(), body);
        return {
          content: [
            {
              type: "text" as const,
              text: `Artifact '${id}' created successfully.`,
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

  // 4. update_designtime_artifact
  // @api GET /IntegrationDesigntimeArtifacts(Id='{Id}',Version='{Version}')
  // @api PUT /IntegrationDesigntimeArtifacts(Id='{Id}',Version='{Version}')
  server.registerTool(
    "update_designtime_artifact",
    {
      description:
        "Update an existing integration designtime artifact. Without confirm, shows a preview. Set confirm to true to execute.",
      inputSchema: z.object({
        id: z.string().describe("The artifact ID"),
        version: z.string().describe("The artifact version"),
        name: z.string().optional().describe("New artifact name"),
        artifactContent: z
          .string()
          .optional()
          .describe("New base64-encoded artifact content"),
        confirm: z
          .boolean()
          .optional()
          .describe("Set to true to actually update the artifact"),
      }),
    },
    async ({ id, version, name, artifactContent, confirm }) => {
      try {
        if (!confirm) {
          const artifact =
            await context.odataClient.getEntity<IntegrationDesigntimeArtifact>(
              buildDesigntimeArtifactPath(id, version)
            );
          const lines: string[] = [];
          lines.push("Artifact to update:");
          lines.push("");
          lines.push(formatArtifact(artifact));
          lines.push("");
          lines.push("Proposed changes:");
          if (name !== undefined)
            lines.push(`  Name: ${artifact.Name} -> ${name}`);
          if (artifactContent !== undefined)
            lines.push(`  ArtifactContent: (new content provided)`);
          lines.push("");
          lines.push("Set confirm to true to proceed.");
          return {
            content: [{ type: "text" as const, text: lines.join("\n") }],
          };
        }
        const body: Record<string, unknown> = {};
        if (name !== undefined) body.Name = name;
        if (artifactContent !== undefined)
          body.ArtifactContent = artifactContent;
        await context.odataClient.put(
          buildDesigntimeArtifactPath(id, version),
          body
        );
        return {
          content: [
            {
              type: "text" as const,
              text: `Artifact '${id}' updated successfully.`,
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

  // 5. delete_designtime_artifact
  // @api GET /IntegrationDesigntimeArtifacts(Id='{Id}',Version='{Version}')
  // @api DELETE /IntegrationDesigntimeArtifacts(Id='{Id}',Version='{Version}')
  server.registerTool(
    "delete_designtime_artifact",
    {
      description:
        "Delete an integration designtime artifact. Without confirm, shows a preview. Set confirm to true to execute.",
      inputSchema: z.object({
        id: z.string().describe("The artifact ID"),
        version: z.string().describe("The artifact version"),
        confirm: z
          .boolean()
          .optional()
          .describe("Set to true to actually delete the artifact"),
      }),
    },
    async ({ id, version, confirm }) => {
      try {
        if (!confirm) {
          const artifact =
            await context.odataClient.getEntity<IntegrationDesigntimeArtifact>(
              buildDesigntimeArtifactPath(id, version)
            );
          const preview = formatArtifact(artifact);
          return {
            content: [
              {
                type: "text" as const,
                text: `Artifact to delete:\n\n${preview}\n\nSet confirm to true to proceed.`,
              },
            ],
          };
        }
        await context.odataClient.delete(
          buildDesigntimeArtifactPath(id, version)
        );
        return {
          content: [
            {
              type: "text" as const,
              text: `Artifact '${id}' deleted successfully.`,
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

  // 6. deploy_designtime_artifact
  // @api POST /DeployIntegrationDesigntimeArtifact
  server.registerTool(
    "deploy_designtime_artifact",
    {
      description:
        "Deploy an integration designtime artifact. Without confirm, shows a preview. Set confirm to true to execute.",
      inputSchema: z.object({
        id: z.string().describe("The artifact ID"),
        version: z.string().describe("The artifact version"),
        confirm: z
          .boolean()
          .optional()
          .describe("Set to true to actually deploy the artifact"),
      }),
    },
    async ({ id, version, confirm }) => {
      try {
        if (!confirm) {
          const lines: string[] = [];
          lines.push("Artifact to deploy:");
          lines.push("");
          lines.push(`Id: ${id}`);
          lines.push(`Version: ${version}`);
          lines.push("");
          lines.push("Set confirm to true to proceed.");
          return {
            content: [{ type: "text" as const, text: lines.join("\n") }],
          };
        }
        const path = `${buildDeployDesigntimeArtifactPath()}?Id='${escapeOData(id)}'&Version='${escapeOData(version)}'`;
        await context.odataClient.post(path);
        return {
          content: [
            {
              type: "text" as const,
              text: `Artifact '${id}' deployment triggered successfully.`,
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

  // 7. validate_designtime_artifact
  // @api POST /ValidateIntegrationDesigntimeArtifact
  server.registerTool(
    "validate_designtime_artifact",
    {
      description:
        "Validate an integration designtime artifact. Without confirm, shows a preview. Set confirm to true to execute.",
      inputSchema: z.object({
        id: z.string().describe("The artifact ID"),
        version: z.string().describe("The artifact version"),
        confirm: z
          .boolean()
          .optional()
          .describe("Set to true to actually validate the artifact"),
      }),
    },
    async ({ id, version, confirm }) => {
      try {
        if (!confirm) {
          const lines: string[] = [];
          lines.push("Artifact to validate:");
          lines.push("");
          lines.push(`Id: ${id}`);
          lines.push(`Version: ${version}`);
          lines.push("");
          lines.push("Set confirm to true to proceed.");
          return {
            content: [{ type: "text" as const, text: lines.join("\n") }],
          };
        }
        const path = `${buildValidateDesigntimeArtifactPath()}?Id='${escapeOData(id)}'&Version='${escapeOData(version)}'`;
        await context.odataClient.post(path);
        return {
          content: [
            {
              type: "text" as const,
              text: `Artifact '${id}' validation triggered successfully.`,
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

  // 8. download_designtime_artifact
  // @api GET /IntegrationDesigntimeArtifacts(Id='{Id}',Version='{Version}')/$value
  server.registerTool(
    "download_designtime_artifact",
    {
      description:
        "Download an integration designtime artifact as a ZIP file.",
      inputSchema: z.object({
        id: z.string().describe("The artifact ID"),
        version: z
          .string()
          .optional()
          .describe("The artifact version (default: 'active')"),
      }),
    },
    async ({ id, version }) => {
      try {
        const content = await context.odataClient.getValue(
          buildDesigntimeArtifactValuePath(id, version ?? "active")
        );
        return {
          content: [
            {
              type: "text" as const,
              text: `Artifact '${id}' downloaded successfully. Content length: ${content.length} bytes (binary ZIP data).`,
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

  // 9. save_designtime_artifact_version
  // @api POST /IntegrationDesigntimeArtifactSaveAsVersion
  server.registerTool(
    "save_designtime_artifact_version",
    {
      description:
        "Save a new version of an integration designtime artifact. Without confirm, shows a preview. Set confirm to true to execute.",
      inputSchema: z.object({
        id: z.string().describe("The artifact ID"),
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
          lines.push("Artifact version to save:");
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
        const path = `${buildSaveDesigntimeArtifactVersionPath()}?Id='${escapeOData(id)}'&Version='${escapeOData(version)}'&SaveAsVersion='${escapeOData(newVersion)}'`;
        await context.odataClient.post(path);
        return {
          content: [
            {
              type: "text" as const,
              text: `Artifact '${id}' saved as version '${newVersion}' successfully.`,
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

  // 10. list_configurations
  // @api GET /IntegrationDesigntimeArtifacts(Id='{Id}',Version='{Version}')/Configurations
  server.registerTool(
    "list_configurations",
    {
      description:
        "List configurations (externalized parameters) of an integration designtime artifact.",
      inputSchema: z.object({
        artifactId: z.string().describe("The artifact ID"),
        version: z
          .string()
          .optional()
          .describe("The artifact version (default: 'active')"),
      }),
    },
    async ({ artifactId, version }) => {
      try {
        const configs =
          await context.odataClient.getCollection<Configuration>(
            buildConfigurationsPath(artifactId, version ?? "active")
          );
        if (configs.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: "No configurations found.",
              },
            ],
          };
        }
        const text = configs.map(formatConfiguration).join("\n\n");
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

  // 11. update_configuration
  // @api PUT /IntegrationDesigntimeArtifacts(Id='{Id}',Version='{Version}')/$links/Configurations('{ParameterKey}')
  server.registerTool(
    "update_configuration",
    {
      description:
        "Update a configuration parameter of an integration designtime artifact. Without confirm, shows a preview. Set confirm to true to execute.",
      inputSchema: z.object({
        artifactId: z.string().describe("The artifact ID"),
        version: z.string().describe("The artifact version"),
        parameterKey: z.string().describe("The configuration parameter key"),
        parameterValue: z
          .string()
          .describe("The new configuration parameter value"),
        dataType: z
          .string()
          .optional()
          .describe("The data type of the parameter"),
        confirm: z
          .boolean()
          .optional()
          .describe("Set to true to actually update the configuration"),
      }),
    },
    async ({
      artifactId,
      version,
      parameterKey,
      parameterValue,
      dataType,
      confirm,
    }) => {
      try {
        if (!confirm) {
          const lines: string[] = [];
          lines.push("Configuration to update:");
          lines.push("");
          lines.push(`ArtifactId: ${artifactId}`);
          lines.push(`Version: ${version}`);
          lines.push(`ParameterKey: ${parameterKey}`);
          lines.push(`ParameterValue: ${parameterValue}`);
          lines.push(`DataType: ${dataType ?? "n/a"}`);
          lines.push("");
          lines.push("Set confirm to true to proceed.");
          return {
            content: [{ type: "text" as const, text: lines.join("\n") }],
          };
        }
        const body: Record<string, unknown> = {
          ParameterValue: parameterValue,
        };
        if (dataType !== undefined) body.DataType = dataType;
        await context.odataClient.put(
          buildConfigurationLinkPath(artifactId, version, parameterKey),
          body
        );
        return {
          content: [
            {
              type: "text" as const,
              text: `Configuration '${parameterKey}' updated successfully.`,
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

  // 12. list_resources
  // @api GET /IntegrationDesigntimeArtifacts(Id='{Id}',Version='{Version}')/Resources
  server.registerTool(
    "list_resources",
    {
      description:
        "List resources of an integration designtime artifact.",
      inputSchema: z.object({
        artifactId: z.string().describe("The artifact ID"),
        version: z
          .string()
          .optional()
          .describe("The artifact version (default: 'active')"),
      }),
    },
    async ({ artifactId, version }) => {
      try {
        const resources =
          await context.odataClient.getCollection<Resource>(
            buildResourcesPath(artifactId, version ?? "active")
          );
        if (resources.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: "No resources found.",
              },
            ],
          };
        }
        const text = resources.map(formatResource).join("\n\n");
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

  // 13. get_resource
  // @api GET /IntegrationDesigntimeArtifacts(Id='{Id}',Version='{Version}')/Resources(Name='{Name}',ResourceType='{Type}')
  server.registerTool(
    "get_resource",
    {
      description:
        "Get details of a specific resource of an integration designtime artifact.",
      inputSchema: z.object({
        artifactId: z.string().describe("The artifact ID"),
        version: z.string().describe("The artifact version"),
        name: z.string().describe("The resource name"),
        resourceType: z.string().describe("The resource type"),
      }),
    },
    async ({ artifactId, version, name, resourceType }) => {
      try {
        const resource = await context.odataClient.getEntity<Resource>(
          buildResourcePath(artifactId, version, name, resourceType)
        );
        const text = formatResourceDetail(resource);
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

  // 14. download_resource
  // @api GET /IntegrationDesigntimeArtifacts(Id='{Id}',Version='{Version}')/Resources(Name='{Name}',ResourceType='{Type}')/$value
  server.registerTool(
    "download_resource",
    {
      description:
        "Download the content of a specific resource of an integration designtime artifact.",
      inputSchema: z.object({
        artifactId: z.string().describe("The artifact ID"),
        version: z.string().describe("The artifact version"),
        name: z.string().describe("The resource name"),
        resourceType: z.string().describe("The resource type"),
      }),
    },
    async ({ artifactId, version, name, resourceType }) => {
      try {
        const content = await context.odataClient.getValue(
          buildResourceValuePath(artifactId, version, name, resourceType)
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

  // 15. count_configurations
  // @api GET /IntegrationDesigntimeArtifacts(Id='{Id}',Version='{Version}')/Configurations/$count
  server.registerTool(
    "count_configurations",
    {
      description:
        "Count configurations (externalized parameters) of an integration designtime artifact.",
      inputSchema: z.object({
        artifactId: z.string().describe("The artifact ID"),
        version: z
          .string()
          .optional()
          .describe("The artifact version (default: 'active')"),
      }),
    },
    async ({ artifactId, version }) => {
      try {
        const count = await context.odataClient.getValue(
          buildConfigurationsCountPath(artifactId, version ?? "active")
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

  // 16. count_resources
  // @api GET /IntegrationDesigntimeArtifacts(Id='{Id}',Version='{Version}')/Resources/$count
  server.registerTool(
    "count_resources",
    {
      description:
        "Count resources of an integration designtime artifact.",
      inputSchema: z.object({
        artifactId: z.string().describe("The artifact ID"),
        version: z
          .string()
          .optional()
          .describe("The artifact version (default: 'active')"),
      }),
    },
    async ({ artifactId, version }) => {
      try {
        const count = await context.odataClient.getValue(
          buildResourcesCountPath(artifactId, version ?? "active")
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

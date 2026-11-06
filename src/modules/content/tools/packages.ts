import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import type { ModuleContext } from "../../../core/types.js";
import type { IntegrationPackage } from "../types.js";
import { escapeOData } from "../../../core/odata-utils.js";
import {
  buildPackagesPath,
  buildPackagePath,
  buildPackageValuePath,
  buildCopyPackagePath,
} from "../queries.js";

function formatPackageSummary(p: IntegrationPackage): string {
  const shortText = p.ShortText
    ? p.ShortText.length > 100
      ? p.ShortText.slice(0, 100) + "..."
      : p.ShortText
    : "n/a";
  const lines: string[] = [];
  lines.push(`Id: ${p.Id ?? "n/a"}`);
  lines.push(`Name: ${p.Name ?? "n/a"}`);
  lines.push(`Version: ${p.Version ?? "n/a"}`);
  lines.push(`Vendor: ${p.Vendor ?? "n/a"}`);
  lines.push(`Mode: ${p.Mode ?? "n/a"}`);
  lines.push(`ShortText: ${shortText}`);
  return lines.join("\n");
}

function formatPackageDetail(p: IntegrationPackage): string {
  const lines: string[] = [];
  lines.push(`Id: ${p.Id ?? "n/a"}`);
  lines.push(`Name: ${p.Name ?? "n/a"}`);
  lines.push(`Version: ${p.Version ?? "n/a"}`);
  lines.push(`Vendor: ${p.Vendor ?? "n/a"}`);
  lines.push(`Mode: ${p.Mode ?? "n/a"}`);
  lines.push(`ShortText: ${p.ShortText ?? "n/a"}`);
  lines.push(`Description: ${p.Description ?? "n/a"}`);
  lines.push(`SupportedPlatform: ${p.SupportedPlatform ?? "n/a"}`);
  lines.push(`Products: ${p.Products ?? "n/a"}`);
  lines.push(`Keywords: ${p.Keywords ?? "n/a"}`);
  lines.push(`Countries: ${p.Countries ?? "n/a"}`);
  lines.push(`Industries: ${p.Industries ?? "n/a"}`);
  lines.push(`LineOfBusiness: ${p.LineOfBusiness ?? "n/a"}`);
  lines.push(`CreatedBy: ${p.CreatedBy ?? "n/a"}`);
  lines.push(`CreationDate: ${p.CreationDate ?? "n/a"}`);
  lines.push(`ModifiedBy: ${p.ModifiedBy ?? "n/a"}`);
  lines.push(`ModifiedDate: ${p.ModifiedDate ?? "n/a"}`);
  return lines.join("\n");
}

export function registerPackageTools(
  server: McpServer,
  context: ModuleContext
) {
  // @api GET /IntegrationPackages
  server.registerTool(
    "list_packages",
    {
      description:
        "List integration packages on the active SAP Cloud Integration tenant. Supports pagination.",
      inputSchema: z.object({
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
    async ({ top, skip }) => {
      try {
        const packages =
          await context.odataClient.getCollection<IntegrationPackage>(
            buildPackagesPath(),
            { $top: top, $skip: skip }
          );
        if (packages.length === 0) {
          return {
            content: [
              { type: "text" as const, text: "No integration packages found." },
            ],
          };
        }
        const text = packages.map(formatPackageSummary).join("\n\n");
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

  // @api GET /IntegrationPackages('{Id}')
  server.registerTool(
    "get_package",
    {
      description:
        "Get details of a specific integration package by its ID.",
      inputSchema: z.object({
        id: z.string().describe("The integration package ID"),
      }),
    },
    async ({ id }) => {
      try {
        const pkg =
          await context.odataClient.getEntity<IntegrationPackage>(
            buildPackagePath(id)
          );
        const text = formatPackageDetail(pkg);
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

  // @api POST /IntegrationPackages
  server.registerTool(
    "create_package",
    {
      description:
        "Create a new integration package. Without confirm, shows a preview. Set confirm to true to execute.",
      inputSchema: z.object({
        id: z.string().describe("The package ID"),
        name: z.string().describe("The package name"),
        shortText: z
          .string()
          .optional()
          .describe("Short description of the package"),
        description: z
          .string()
          .optional()
          .describe("Detailed description of the package"),
        version: z
          .string()
          .optional()
          .describe("Package version, e.g. '1.0.0'"),
        vendor: z.string().optional().describe("Package vendor"),
        confirm: z
          .boolean()
          .optional()
          .describe("Set to true to actually create the package"),
      }),
    },
    async ({ id, name, shortText, description, version, vendor, confirm }) => {
      try {
        if (!confirm) {
          const lines: string[] = [];
          lines.push("Package to create:");
          lines.push("");
          lines.push(`Id: ${id}`);
          lines.push(`Name: ${name}`);
          lines.push(`ShortText: ${shortText ?? "n/a"}`);
          lines.push(`Description: ${description ?? "n/a"}`);
          lines.push(`Version: ${version ?? "n/a"}`);
          lines.push(`Vendor: ${vendor ?? "n/a"}`);
          lines.push("");
          lines.push("Set confirm to true to proceed.");
          return {
            content: [{ type: "text" as const, text: lines.join("\n") }],
          };
        }
        const body: Record<string, unknown> = { Id: id, Name: name };
        if (shortText !== undefined) body.ShortText = shortText;
        if (description !== undefined) body.Description = description;
        if (version !== undefined) body.Version = version;
        if (vendor !== undefined) body.Vendor = vendor;
        await context.odataClient.post(buildPackagesPath(), body);
        return {
          content: [
            {
              type: "text" as const,
              text: `Package '${id}' created successfully.`,
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

  // @api GET /IntegrationPackages('{Id}')
  // @api PUT /IntegrationPackages('{Id}')
  server.registerTool(
    "update_package",
    {
      description:
        "Update an existing integration package. Without confirm, shows a preview of changes. Set confirm to true to execute.",
      inputSchema: z.object({
        id: z.string().describe("The package ID"),
        name: z.string().optional().describe("New package name"),
        shortText: z
          .string()
          .optional()
          .describe("New short description"),
        description: z
          .string()
          .optional()
          .describe("New detailed description"),
        version: z.string().optional().describe("New version"),
        vendor: z.string().optional().describe("New vendor"),
        confirm: z
          .boolean()
          .optional()
          .describe("Set to true to actually update the package"),
      }),
    },
    async ({ id, name, shortText, description, version, vendor, confirm }) => {
      try {
        if (!confirm) {
          const pkg =
            await context.odataClient.getEntity<IntegrationPackage>(
              buildPackagePath(id)
            );
          const lines: string[] = [];
          lines.push("Package to update:");
          lines.push("");
          lines.push(formatPackageDetail(pkg));
          lines.push("");
          lines.push("Proposed changes:");
          if (name !== undefined) lines.push(`  Name: ${pkg.Name} -> ${name}`);
          if (shortText !== undefined)
            lines.push(`  ShortText: ${pkg.ShortText} -> ${shortText}`);
          if (description !== undefined)
            lines.push(`  Description: ${pkg.Description} -> ${description}`);
          if (version !== undefined)
            lines.push(`  Version: ${pkg.Version} -> ${version}`);
          if (vendor !== undefined)
            lines.push(`  Vendor: ${pkg.Vendor} -> ${vendor}`);
          lines.push("");
          lines.push("Set confirm to true to proceed.");
          return {
            content: [{ type: "text" as const, text: lines.join("\n") }],
          };
        }
        const body: Record<string, unknown> = {};
        if (name !== undefined) body.Name = name;
        if (shortText !== undefined) body.ShortText = shortText;
        if (description !== undefined) body.Description = description;
        if (version !== undefined) body.Version = version;
        if (vendor !== undefined) body.Vendor = vendor;
        await context.odataClient.put(buildPackagePath(id), body);
        return {
          content: [
            {
              type: "text" as const,
              text: `Package '${id}' updated successfully.`,
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

  // @api GET /IntegrationPackages('{Id}')
  // @api DELETE /IntegrationPackages('{Id}')
  server.registerTool(
    "delete_package",
    {
      description:
        "Delete an integration package. Without confirm, shows a preview. Set confirm to true to execute.",
      inputSchema: z.object({
        id: z.string().describe("The package ID to delete"),
        confirm: z
          .boolean()
          .optional()
          .describe("Set to true to actually delete the package"),
      }),
    },
    async ({ id, confirm }) => {
      try {
        if (!confirm) {
          const pkg =
            await context.odataClient.getEntity<IntegrationPackage>(
              buildPackagePath(id)
            );
          const preview = formatPackageDetail(pkg);
          return {
            content: [
              {
                type: "text" as const,
                text: `Package to delete:\n\n${preview}\n\nSet confirm to true to proceed.`,
              },
            ],
          };
        }
        await context.odataClient.delete(buildPackagePath(id));
        return {
          content: [
            {
              type: "text" as const,
              text: `Package '${id}' deleted successfully.`,
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

  // @api GET /IntegrationPackages('{Id}')/$value
  server.registerTool(
    "download_package",
    {
      description:
        "Download an integration package as a ZIP file. Returns content length information.",
      inputSchema: z.object({
        id: z.string().describe("The package ID to download"),
      }),
    },
    async ({ id }) => {
      try {
        const content = await context.odataClient.getValue(
          buildPackageValuePath(id)
        );
        return {
          content: [
            {
              type: "text" as const,
              text: `Package '${id}' downloaded successfully. Content length: ${content.length} bytes (binary ZIP data).`,
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

  // @api POST /CopyIntegrationPackage
  server.registerTool(
    "copy_package",
    {
      description:
        "Copy an integration package. Without confirm, shows a preview. Set confirm to true to execute.",
      inputSchema: z.object({
        id: z.string().describe("The package ID to copy"),
        importMode: z
          .enum(["CREATE_COPY", "OVERWRITE", "OVERWRITE_MERGE"])
          .optional()
          .describe("Import mode for the copy operation"),
        suffix: z
          .string()
          .optional()
          .describe("Suffix to append to the copied package name"),
        confirm: z
          .boolean()
          .optional()
          .describe("Set to true to actually copy the package"),
      }),
    },
    async ({ id, importMode, suffix, confirm }) => {
      try {
        if (!confirm) {
          const lines: string[] = [];
          lines.push("Package to copy:");
          lines.push("");
          lines.push(`Id: ${id}`);
          lines.push(`ImportMode: ${importMode ?? "n/a"}`);
          lines.push(`Suffix: ${suffix ?? "n/a"}`);
          lines.push("");
          lines.push("Set confirm to true to proceed.");
          return {
            content: [{ type: "text" as const, text: lines.join("\n") }],
          };
        }
        let path = `${buildCopyPackagePath()}?Id='${escapeOData(id)}'`;
        if (importMode !== undefined)
          path += `&ImportMode=${encodeURIComponent(importMode)}`;
        if (suffix !== undefined)
          path += `&Suffix='${escapeOData(suffix)}'`;
        await context.odataClient.post(path);
        return {
          content: [
            {
              type: "text" as const,
              text: `Package '${id}' copied successfully.`,
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

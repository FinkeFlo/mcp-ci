import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type { Module, ModuleContext } from "../../core/types.js";
import type { GenericIdempotentRepositoryEntry } from "./types.js";
import { buildEntriesPath, buildEntryPath } from "./queries.js";

function formatEntry(e: GenericIdempotentRepositoryEntry): string {
  return [
    `  Source: ${e.Source ?? "n/a"}`,
    `  Entry: ${e.Entry ?? "n/a"}`,
    `  Component: ${e.Component ?? "n/a"}`,
    `  Vendor: ${e.Vendor ?? "n/a"}`,
    `  CreationTime: ${e.CreationTime ?? "n/a"}`,
    `  ExpirationTime: ${e.ExpirationTime ?? "n/a"}`,
  ].join("\n");
}

export const idempotentModule: Module = {
  name: "idempotent",
  register(server: McpServer, context: ModuleContext) {
    // @api GET /GenericIdempotentRepositoryEntries
    server.registerTool(
      "get_idempotent_entries",
      {
        description:
          "List all Idempotent Repository entries for a given Entry ID in SAP Cloud Integration.",
        inputSchema: z.object({
          id: z.string().describe("The Entry ID to look up (plaintext)"),
        }),
      },
      async ({ id }) => {
        try {
          const entries =
            await context.odataClient.getCollection<GenericIdempotentRepositoryEntry>(
              buildEntriesPath(id)
            );

          if (entries.length === 0) {
            return {
              content: [{ type: "text" as const, text: "No entries found." }],
            };
          }

          const output = entries
            .map((e, i) => `[Entry ${i + 1}]\n${formatEntry(e)}`)
            .join("\n\n");

          return {
            content: [
              {
                type: "text" as const,
                text: `${entries.length} entry/entries found:\n\n${output}`,
              },
            ],
          };
        } catch (error) {
          return {
            isError: true,
            content: [{ type: "text" as const, text: (error as Error).message }],
          };
        }
      }
    );

    // @api GET /GenericIdempotentRepositoryEntries(HexVendor='{HexVendor}',HexSource='{HexSource}',HexEntry='{HexEntry}',HexComponent='{HexComponent}')
    server.registerTool(
      "get_idempotent_entry",
      {
        description:
          "Get a specific Idempotent Repository entry by its four-part key (vendor, source, entry, component) in SAP Cloud Integration.",
        inputSchema: z.object({
          vendor: z.string().describe("The Vendor (plaintext)"),
          source: z.string().describe("The Source (plaintext)"),
          entry: z.string().describe("The Entry (plaintext)"),
          component: z.string().describe("The Component (plaintext)"),
        }),
      },
      async ({ vendor, source, entry, component }) => {
        try {
          const e =
            await context.odataClient.getEntity<GenericIdempotentRepositoryEntry>(
              buildEntryPath(vendor, source, entry, component)
            );

          return {
            content: [
              {
                type: "text" as const,
                text: `Idempotent Repository Entry:\n${formatEntry(e)}`,
              },
            ],
          };
        } catch (error) {
          return {
            isError: true,
            content: [{ type: "text" as const, text: (error as Error).message }],
          };
        }
      }
    );

    // @api DELETE /GenericIdempotentRepositoryEntries(HexVendor='{HexVendor}',HexSource='{HexSource}',HexEntry='{HexEntry}',HexComponent='{HexComponent}')
    server.registerTool(
      "delete_idempotent_entry",
      {
        description:
          "Delete an Idempotent Repository entry in SAP Cloud Integration. Without confirm:true, shows a preview and requires confirmation.",
        inputSchema: z.object({
          vendor: z.string().describe("The Vendor (plaintext)"),
          source: z.string().describe("The Source (plaintext)"),
          entry: z.string().describe("The Entry (plaintext)"),
          component: z.string().describe("The Component (plaintext)"),
          confirm: z
            .boolean()
            .optional()
            .describe("Set to true to confirm deletion"),
        }),
      },
      async ({ vendor, source, entry, component, confirm }) => {
        const path = buildEntryPath(vendor, source, entry, component);

        if (!confirm) {
          try {
            const e =
              await context.odataClient.getEntity<GenericIdempotentRepositoryEntry>(
                path
              );

            return {
              content: [
                {
                  type: "text" as const,
                  text: `Entry to be deleted:\n${formatEntry(e)}\n\nCall again with confirm: true to delete.`,
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

        try {
          await context.odataClient.delete(path);
          return {
            content: [
              { type: "text" as const, text: "Entry deleted successfully." },
            ],
          };
        } catch (error) {
          return {
            isError: true,
            content: [{ type: "text" as const, text: (error as Error).message }],
          };
        }
      }
    );
  },
};

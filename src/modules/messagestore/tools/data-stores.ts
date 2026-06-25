import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type { ModuleContext } from "../../../core/types.js";
import type { DataStore, DataStoreEntry } from "../types.js";
import {
  buildDataStoresPath,
  buildDataStorePath,
  buildDataStoreEntriesPath,
  buildDataStoreEntriesByStorePath,
  buildDataStoreEntryPath,
  buildDataStoreEntryValuePath,
} from "../queries.js";

function formatDataStore(ds: DataStore): string {
  return [
    `DataStoreName: ${ds.DataStoreName ?? "n/a"}`,
    `IntegrationFlow: ${ds.IntegrationFlow ?? "n/a"}`,
    `Type: ${ds.Type ?? "n/a"}`,
    `Visibility: ${ds.Visibility ?? "n/a"}`,
    `NumberOfMessages: ${ds.NumberOfMessages ?? "n/a"}`,
    `NumberOfOverdueMessages: ${ds.NumberOfOverdueMessages ?? "n/a"}`,
  ].join("\n");
}

function formatDataStoreEntry(e: DataStoreEntry): string {
  return [
    `Id: ${e.Id ?? "n/a"}`,
    `DataStoreName: ${e.DataStoreName ?? "n/a"}`,
    `IntegrationFlow: ${e.IntegrationFlow ?? "n/a"}`,
    `Type: ${e.Type ?? "n/a"}`,
    `Status: ${e.Status ?? "n/a"}`,
    `MessageId: ${e.MessageId ?? "n/a"}`,
    `DueAt: ${e.DueAt ?? "n/a"}`,
    `CreatedAt: ${e.CreatedAt ?? "n/a"}`,
    `RetainUntil: ${e.RetainUntil ?? "n/a"}`,
  ].join("\n");
}

export function registerDataStoreTools(
  server: McpServer,
  context: ModuleContext
) {
  // @api GET /DataStores
  server.registerTool(
    "list_data_stores",
    {
      description:
        "List data stores on the active SAP Cloud Integration tenant. Optionally filter to show only stores with overdue messages.",
      inputSchema: z.object({
        overdueonly: z
          .enum(["true", "false"])
          .optional()
          .describe(
            "If 'true', only data stores with overdue messages are shown"
          ),
      }),
    },
    async ({ overdueonly }) => {
      try {
        let path = buildDataStoresPath();
        if (overdueonly) {
          path += `?overdueonly=${overdueonly}`;
        }
        const stores = await context.odataClient.getCollection<DataStore>(
          path
        );
        if (stores.length === 0) {
          return {
            content: [
              { type: "text" as const, text: "No data stores found." },
            ],
          };
        }
        const text = stores.map(formatDataStore).join("\n\n");
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

  // @api GET /DataStores(DataStoreName='{DataStoreName}',IntegrationFlow='{IntegrationFlowId}',Type='{Type}')
  server.registerTool(
    "get_data_store",
    {
      description:
        "Get a specific data store by its composite key (DataStoreName, IntegrationFlow, Type).",
      inputSchema: z.object({
        dataStoreName: z.string().describe("Name of the data store"),
        integrationFlow: z
          .string()
          .describe("The integration flow ID"),
        type: z
          .string()
          .describe(
            "Type of the data store (e.g. 'XI', 'AS4', or empty string for Global/IntegrationFlow visibility)"
          ),
      }),
    },
    async ({ dataStoreName, integrationFlow, type }) => {
      try {
        const ds = await context.odataClient.getEntity<DataStore>(
          buildDataStorePath(dataStoreName, integrationFlow, type)
        );
        const text = formatDataStore(ds);
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

  // @api GET /DataStores(DataStoreName='{DataStoreName}',IntegrationFlow='{IntegrationFlowId}',Type='{Type}')
  // @api DELETE /DataStores(DataStoreName='{DataStoreName}',IntegrationFlow='{IntegrationFlowId}',Type='{Type}')
  server.registerTool(
    "delete_data_store",
    {
      description:
        "Delete a data store by its composite key. Without confirm, shows a preview. Set confirm to true to execute.",
      inputSchema: z.object({
        dataStoreName: z.string().describe("Name of the data store"),
        integrationFlow: z
          .string()
          .describe("The integration flow ID"),
        type: z
          .string()
          .describe("Type of the data store"),
        confirm: z
          .boolean()
          .optional()
          .describe("Set to true to actually delete the data store"),
      }),
    },
    async ({ dataStoreName, integrationFlow, type, confirm }) => {
      try {
        const path = buildDataStorePath(
          dataStoreName,
          integrationFlow,
          type
        );
        if (!confirm) {
          const ds = await context.odataClient.getEntity<DataStore>(path);
          const preview = formatDataStore(ds);
          return {
            content: [
              {
                type: "text" as const,
                text: `Data store to delete:\n\n${preview}\n\nSet confirm to true to proceed.`,
              },
            ],
          };
        }
        await context.odataClient.delete(path);
        return {
          content: [
            {
              type: "text" as const,
              text: `Data store '${dataStoreName}' deleted successfully.`,
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

  // @api GET /DataStoreEntries
  server.registerTool(
    "list_data_store_entries",
    {
      description:
        "List all data store entries on the tenant. Supports filtering by overdue status and message ID.",
      inputSchema: z.object({
        overdueonly: z
          .enum(["true", "false"])
          .optional()
          .describe(
            "If 'true', only entries with overdue messages are shown"
          ),
        messageid: z
          .string()
          .optional()
          .describe("Filter entries by message processing log ID"),
      }),
    },
    async ({ overdueonly, messageid }) => {
      try {
        let path = buildDataStoreEntriesPath();
        const params: string[] = [];
        if (overdueonly) params.push(`overdueonly=${overdueonly}`);
        if (messageid) params.push(`messageid=${encodeURIComponent(messageid)}`);
        if (params.length > 0) path += `?${params.join("&")}`;
        const entries =
          await context.odataClient.getCollection<DataStoreEntry>(path);
        if (entries.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: "No data store entries found.",
              },
            ],
          };
        }
        const text = entries.map(formatDataStoreEntry).join("\n\n");
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

  // @api GET /DataStores(DataStoreName='{DataStoreName}',IntegrationFlow='{IntegrationFlowId}',Type='{Type}')/Entries
  server.registerTool(
    "list_data_store_entries_by_store",
    {
      description:
        "List data store entries for a specific data store identified by its composite key.",
      inputSchema: z.object({
        dataStoreName: z.string().describe("Name of the data store"),
        integrationFlow: z
          .string()
          .describe("The integration flow ID"),
        type: z
          .string()
          .describe("Type of the data store"),
      }),
    },
    async ({ dataStoreName, integrationFlow, type }) => {
      try {
        const entries =
          await context.odataClient.getCollection<DataStoreEntry>(
            buildDataStoreEntriesByStorePath(
              dataStoreName,
              integrationFlow,
              type
            )
          );
        if (entries.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: "No data store entries found.",
              },
            ],
          };
        }
        const text = entries.map(formatDataStoreEntry).join("\n\n");
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

  // @api GET /DataStoreEntries(Id='{Id}',DataStoreName='{DataStoreName}',IntegrationFlow='{IntegrationFlowId}',Type='{Type}')
  server.registerTool(
    "get_data_store_entry",
    {
      description:
        "Get a specific data store entry by its 4-part composite key.",
      inputSchema: z.object({
        id: z.string().describe("The data store entry ID"),
        dataStoreName: z.string().describe("Name of the data store"),
        integrationFlow: z
          .string()
          .describe("The integration flow ID"),
        type: z
          .string()
          .describe("Type of the data store"),
      }),
    },
    async ({ id, dataStoreName, integrationFlow, type }) => {
      try {
        const entry = await context.odataClient.getEntity<DataStoreEntry>(
          buildDataStoreEntryPath(id, dataStoreName, integrationFlow, type)
        );
        const text = formatDataStoreEntry(entry);
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

  // @api GET /DataStoreEntries(Id='{Id}',DataStoreName='{DataStoreName}',IntegrationFlow='{IntegrationFlowId}',Type='{Type}')
  // @api DELETE /DataStoreEntries(Id='{Id}',DataStoreName='{DataStoreName}',IntegrationFlow='{IntegrationFlowId}',Type='{Type}')
  server.registerTool(
    "delete_data_store_entry",
    {
      description:
        "Delete a data store entry by its 4-part composite key. Without confirm, shows a preview. Set confirm to true to execute.",
      inputSchema: z.object({
        id: z.string().describe("The data store entry ID"),
        dataStoreName: z.string().describe("Name of the data store"),
        integrationFlow: z
          .string()
          .describe("The integration flow ID"),
        type: z
          .string()
          .describe("Type of the data store"),
        confirm: z
          .boolean()
          .optional()
          .describe("Set to true to actually delete the entry"),
      }),
    },
    async ({ id, dataStoreName, integrationFlow, type, confirm }) => {
      try {
        const path = buildDataStoreEntryPath(
          id,
          dataStoreName,
          integrationFlow,
          type
        );
        if (!confirm) {
          const entry =
            await context.odataClient.getEntity<DataStoreEntry>(path);
          const preview = formatDataStoreEntry(entry);
          return {
            content: [
              {
                type: "text" as const,
                text: `Data store entry to delete:\n\n${preview}\n\nSet confirm to true to proceed.`,
              },
            ],
          };
        }
        await context.odataClient.delete(path);
        return {
          content: [
            {
              type: "text" as const,
              text: `Data store entry '${id}' deleted successfully.`,
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

  // @api GET /DataStoreEntries(Id='{Id}',DataStoreName='{DataStoreName}',IntegrationFlow='{IntegrationFlowId}',Type='{Type}')/$value
  server.registerTool(
    "download_data_store_entry",
    {
      description:
        "Download the content of a data store entry by its 4-part composite key.",
      inputSchema: z.object({
        id: z.string().describe("The data store entry ID"),
        dataStoreName: z.string().describe("Name of the data store"),
        integrationFlow: z
          .string()
          .describe("The integration flow ID"),
        type: z
          .string()
          .describe("Type of the data store"),
      }),
    },
    async ({ id, dataStoreName, integrationFlow, type }) => {
      try {
        const content = await context.odataClient.getValue(
          buildDataStoreEntryValuePath(
            id,
            dataStoreName,
            integrationFlow,
            type
          )
        );
        if (!content) {
          return {
            content: [
              {
                type: "text" as const,
                text: "No content available.",
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

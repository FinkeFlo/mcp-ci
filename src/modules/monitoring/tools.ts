import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import type { ModuleContext, Module } from "../../core/types.js";
import type {
  MessageProcessingLog,
  CustomHeaderProperty,
  AdapterAttribute,
  MessageProcessingLogAttachment,
  MessageStoreEntry,
  ErrorInformation,
} from "./types.js";
import { buildListMessagesParams, buildGetErrorsParams, buildCountParams, buildErrorInformationPath } from "./queries.js";

const API_PATH = "/api/v1/MessageProcessingLogs";

function formatMessage(m: MessageProcessingLog): string {
  const lines = [
    `MessageGuid: ${m.MessageGuid}`,
    `Status: ${m.Status}`,
    `Flow: ${m.IntegrationFlowName ?? "n/a"}`,
    `Sender: ${m.Sender ?? "n/a"} -> Receiver: ${m.Receiver ?? "n/a"}`,
    `Start: ${m.LogStart ?? "n/a"} | End: ${m.LogEnd ?? "n/a"}`,
  ];
  if (m.AlternateWebLink) lines.push(`Link: ${m.AlternateWebLink}`);
  return lines.join("\n");
}

export const monitoringModule: Module = {
  name: "monitoring",
  register(server: McpServer, context: ModuleContext) {
    // --- list_messages ---
    // @api GET /MessageProcessingLogs
    server.registerTool(
      "list_messages",
      {
        description:
          "List message processing logs from SAP CPI with optional filters",
        inputSchema: z.object({
          status: z
            .string()
            .optional()
            .describe(
              "Filter by status (COMPLETED, FAILED, PROCESSING, RETRY, etc.)"
            ),
          flowName: z
            .string()
            .optional()
            .describe("Filter by integration flow name"),
          from: z
            .string()
            .optional()
            .describe("Start time (ISO 8601, e.g. 2026-03-26T00:00:00Z)"),
          to: z
            .string()
            .optional()
            .describe("End time (ISO 8601)"),
          correlationId: z
            .string()
            .optional()
            .describe("Filter by correlation ID"),
          applicationMessageId: z
            .string()
            .optional()
            .describe("Filter by application message ID"),
          customHeaders: z
            .record(z.string(), z.string())
            .optional()
            .describe(
              "Filter by custom header properties (key-value pairs), e.g. { documentNumber: '1234567890' }"
            ),
          top: z
            .number()
            .optional()
            .describe("Max results (default 50, max 200)"),
        }),
      },
      async (filters) => {
        try {
          const params = buildListMessagesParams(filters);
          const messages =
            await context.odataClient.getCollection<MessageProcessingLog>(
              API_PATH,
              params
            );
          if (messages.length === 0) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: "No messages found matching the given filters.",
                },
              ],
            };
          }
          const text = messages.map(formatMessage).join("\n---\n");
          return {
            content: [
              {
                type: "text" as const,
                text: `Found ${messages.length} message(s):\n\n${text}`,
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

    // --- get_message ---
    // @api GET /MessageProcessingLogs('{MessageGuid}')
    // @api GET /MessageProcessingLogs('{MessageGuid}')/AdapterAttributes
    // @api GET /MessageProcessingLogs('{MessageGuid}')/CustomHeaderProperties
    // @api GET /MessageProcessingLogs('{MessageGuid}')/ErrorInformation/$value
    server.registerTool(
      "get_message",
      {
        description:
          "Get details of a single message processing log by MessageGuid, including custom headers, adapter attributes, and error info for failed messages",
        inputSchema: z.object({
          messageGuid: z.string().describe("The MessageGuid of the message"),
        }),
      },
      async ({ messageGuid }) => {
        try {
          const message = await context.odataClient.getEntity<
            MessageProcessingLog & {
              CustomHeaderProperties: { results: CustomHeaderProperty[] };
              AdapterAttributes: { results: AdapterAttribute[] };
            }
          >(`${API_PATH}('${messageGuid}')`, {
            $expand: "CustomHeaderProperties,AdapterAttributes",
          });

          const sections: string[] = [formatMessage(message)];

          // Extended details
          const extendedFields: [string, unknown][] = [
            ["CustomStatus", message.CustomStatus],
            ["TransactionId", message.TransactionId],
            ["ApplicationMessageType", message.ApplicationMessageType],
            ["PredecessorMessageGuid", message.PredecessorMessageGuid],
            ["PackageId", message.IntegrationArtifact?.PackageId],
            ["PackageName", message.IntegrationArtifact?.PackageName],
          ];
          const extendedLines = extendedFields
            .filter(([, v]) => v != null)
            .map(([k, v]) => `  ${k}: ${v}`);
          if (extendedLines.length > 0) {
            sections.push("Extended Details:\n" + extendedLines.join("\n"));
          }

          // Custom header properties
          const headers = message.CustomHeaderProperties?.results ?? [];
          if (headers.length > 0) {
            sections.push(
              "Custom Headers:\n" +
                headers
                  .map((h) => `  ${h.Name ?? h.Id}: ${h.Value ?? "n/a"}`)
                  .join("\n")
            );
          }

          // Adapter attributes
          const attrs = message.AdapterAttributes?.results ?? [];
          if (attrs.length > 0) {
            sections.push(
              "Adapter Attributes:\n" +
                attrs
                  .map((a) => `  ${a.Name ?? a.Id}: ${a.Value ?? "n/a"}`)
                  .join("\n")
            );
          }

          // Error info for failed/retry messages
          if (
            message.Status === "FAILED" ||
            message.Status === "RETRY"
          ) {
            try {
              const errorText = await context.odataClient.getValue(
                `${API_PATH}('${messageGuid}')/ErrorInformation/$value`
              );
              sections.push(`Error Information:\n${errorText}`);
            } catch {
              sections.push("Error Information: (could not retrieve)");
            }
          }

          return {
            content: [
              { type: "text" as const, text: sections.join("\n\n") },
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

    // --- count_messages ---
    // @api GET /MessageProcessingLogs/$count
    server.registerTool(
      "count_messages",
      {
        description:
          "Count message processing logs in SAP CPI matching optional filters",
        inputSchema: z.object({
          status: z
            .string()
            .optional()
            .describe(
              "Filter by status (COMPLETED, FAILED, PROCESSING, RETRY, etc.)"
            ),
          flowName: z
            .string()
            .optional()
            .describe("Filter by integration flow name"),
          from: z
            .string()
            .optional()
            .describe("Start time (ISO 8601, e.g. 2026-03-26T00:00:00Z)"),
          to: z
            .string()
            .optional()
            .describe("End time (ISO 8601)"),
          correlationId: z
            .string()
            .optional()
            .describe("Filter by correlation ID"),
          applicationMessageId: z
            .string()
            .optional()
            .describe("Filter by application message ID"),
          customHeaders: z
            .record(z.string(), z.string())
            .optional()
            .describe(
              "Filter by custom header properties (key-value pairs), e.g. { documentNumber: '1234567890' }"
            ),
        }),
      },
      async (filters) => {
        try {
          const params = buildCountParams(filters);
          const entries = Object.entries(params);
          const queryString =
            entries.length > 0
              ? "?" +
                entries
                  .map(
                    ([k, v]) =>
                      `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`
                  )
                  .join("&")
              : "";
          const count = await context.odataClient.getValue(
            `${API_PATH}/$count${queryString}`
          );
          return {
            content: [
              {
                type: "text" as const,
                text: `Message count: ${count}`,
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

    // --- get_errors ---
    // @api GET /MessageProcessingLogs
    // @api GET /MessageProcessingLogs('{MessageGuid}')/ErrorInformation/$value
    server.registerTool(
      "get_errors",
      {
        description:
          "Get recent failed messages grouped by integration flow, with error counts and sample errors",
        inputSchema: z.object({
          from: z
            .string()
            .optional()
            .describe(
              "Start time (ISO 8601). Defaults to 1 hour ago."
            ),
        }),
      },
      async (filters) => {
        try {
          const params = buildGetErrorsParams(filters);
          const messages =
            await context.odataClient.getCollection<MessageProcessingLog>(
              API_PATH,
              params
            );

          if (messages.length === 0) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: "No failed messages found in the given time range.",
                },
              ],
            };
          }

          // Group by IntegrationFlowName
          const groups = new Map<
            string,
            { count: number; latest: MessageProcessingLog }
          >();
          for (const msg of messages) {
            const key = msg.IntegrationFlowName ?? "(unknown)";
            const existing = groups.get(key);
            if (existing) {
              existing.count++;
            } else {
              groups.set(key, { count: 1, latest: msg });
            }
          }

          // Fetch sample error per flow in parallel
          const flowEntries = Array.from(groups.entries());
          const errorTexts = await Promise.all(
            flowEntries.map(async ([, { latest }]) => {
              try {
                return await context.odataClient.getValue(
                  `${API_PATH}('${latest.MessageGuid}')/ErrorInformation/$value`
                );
              } catch {
                return null;
              }
            })
          );

          const lines: string[] = [
            `Total failed messages: ${messages.length}`,
            `Affected flows: ${groups.size}`,
            "",
          ];

          flowEntries.forEach(([flowName, { count, latest }], i) => {
            lines.push(`Flow: ${flowName}`);
            lines.push(`  Failures: ${count}`);
            lines.push(`  Latest: ${latest.LogEnd ?? "n/a"}`);
            lines.push(`  MessageGuid: ${latest.MessageGuid}`);
            if (latest.AlternateWebLink) {
              lines.push(`  Link: ${latest.AlternateWebLink}`);
            }
            if (errorTexts[i]) {
              lines.push(`  Sample error: ${errorTexts[i]}`);
            }
            lines.push("");
          });

          return {
            content: [
              { type: "text" as const, text: lines.join("\n") },
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
    // --- get_attachments ---
    // @api GET /MessageProcessingLogs('{MessageGuid}')/Attachments
    server.registerTool(
      "get_attachments",
      {
        description:
          "List attachments for a message processing log, or fetch the raw content of a specific attachment",
        inputSchema: z.object({
          messageGuid: z.string().describe("The MessageGuid of the message"),
          attachmentId: z
            .string()
            .optional()
            .describe(
              "If provided, fetches the raw $value content of this attachment"
            ),
        }),
      },
      async ({ messageGuid, attachmentId }) => {
        const MAX_SIZE = 100 * 1024;
        try {
          if (attachmentId) {
            const content = await context.odataClient.getValue(
              `${API_PATH}('${messageGuid}')/Attachments('${attachmentId}')/$value`
            );
            const text =
              content.length > MAX_SIZE
                ? `${content.slice(0, MAX_SIZE)}\n\n[Truncated: original size ${content.length} chars]`
                : content;
            return {
              content: [{ type: "text" as const, text }],
            };
          }

          const attachments =
            await context.odataClient.getCollection<MessageProcessingLogAttachment>(
              `${API_PATH}('${messageGuid}')/Attachments`
            );

          if (attachments.length === 0) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: "No attachments found for this message.",
                },
              ],
            };
          }

          const lines = attachments.map((a) =>
            [
              `Id: ${a.Id}`,
              `Name: ${a.Name ?? "n/a"}`,
              `ContentType: ${a.ContentType ?? "n/a"}`,
              `Size: ${a.PayloadSize ?? "n/a"}`,
              `Time: ${a.TimeStamp ?? "n/a"}`,
            ].join("\n")
          );

          return {
            content: [
              {
                type: "text" as const,
                text: `Found ${attachments.length} attachment(s):\n\n${lines.join("\n---\n")}`,
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
    // @api GET /MessageProcessingLogs('{MessageGuid}')/ErrorInformation
    server.registerTool(
      "get_error_info",
      {
        description:
          "Get the ErrorInformation entity (metadata) for a message processing log: Type and LastErrorModelStepId",
        inputSchema: z.object({
          messageGuid: z
            .string()
            .describe("The MessageGuid of the message processing log"),
        }),
      },
      async ({ messageGuid }) => {
        try {
          const entity = await context.odataClient.getEntity<ErrorInformation>(
            buildErrorInformationPath(messageGuid)
          );
          const lines = [
            `MessageGuid: ${entity.MessageGuid}`,
            `Type: ${entity.Type ?? "n/a"}`,
            `LastErrorModelStepId: ${entity.LastErrorModelStepId ?? "n/a"}`,
          ];
          return {
            content: [{ type: "text" as const, text: lines.join("\n") }],
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
    // --- get_message_store_entries ---
    // @api GET /MessageProcessingLogs('{MessageGuid}')/MessageStoreEntries
    server.registerTool(
      "get_message_store_entries",
      {
        description:
          "List message store entries for a message processing log, or fetch the raw content of a specific entry",
        inputSchema: z.object({
          messageGuid: z.string().describe("The MessageGuid of the message"),
          entryId: z
            .string()
            .optional()
            .describe(
              "If provided, fetches the raw $value content of this message store entry"
            ),
        }),
      },
      async ({ messageGuid, entryId }) => {
        const MAX_SIZE = 100 * 1024;
        try {
          if (entryId) {
            const content = await context.odataClient.getValue(
              `${API_PATH}('${messageGuid}')/MessageStoreEntries('${entryId}')/$value`
            );
            const text =
              content.length > MAX_SIZE
                ? `${content.slice(0, MAX_SIZE)}\n\n[Truncated: original size ${content.length} chars]`
                : content;
            return {
              content: [{ type: "text" as const, text }],
            };
          }

          const entries =
            await context.odataClient.getCollection<MessageStoreEntry>(
              `${API_PATH}('${messageGuid}')/MessageStoreEntries`
            );

          if (entries.length === 0) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: "No message store entries found for this message.",
                },
              ],
            };
          }

          const lines = entries.map((e) =>
            [
              `Id: ${e.Id}`,
              `StoreId: ${e.MessageStoreId ?? "n/a"}`,
              `Time: ${e.TimeStamp ?? "n/a"}`,
              `HasAttachments: ${e.HasAttachments ?? "n/a"}`,
            ].join("\n")
          );

          return {
            content: [
              {
                type: "text" as const,
                text: `Found ${entries.length} message store entr${entries.length === 1 ? "y" : "ies"}:\n\n${lines.join("\n---\n")}`,
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
  },
};

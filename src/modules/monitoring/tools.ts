import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import type { ModuleContext, Module } from "../../core/types.js";
import { textTool } from "../../core/tool.js";
import type { ODataParams } from "../../core/odata-client.js";
import type {
  MessageProcessingLog,
  CustomHeaderProperty,
  AdapterAttribute,
  MessageProcessingLogAttachment,
  MessageStoreEntry,
  ErrorInformation,
} from "./types.js";
import {
  buildListMessagesParams,
  buildGetErrorsParams,
  buildCountParams,
  buildAggregateParams,
  buildErrorInformationPath,
  AGGREGATE_FIELD_TO_ODATA,
  type ListMessagesFilters,
} from "./queries.js";

const API_PATH = "/api/v1/MessageProcessingLogs";

const CUSTOM_STATUS_DESCRIPTION =
  "Filter by custom status set by the iFlow (e.g. ERROR, ESCALATED). Independent of Status — useful for SOAP soft faults where Status=COMPLETED but CustomStatus=ERROR.";

function formatMessage(m: MessageProcessingLog): string {
  const lines = [
    `MessageGuid: ${m.MessageGuid}`,
    m.CustomStatus
      ? `Status: ${m.Status} (CustomStatus: ${m.CustomStatus})`
      : `Status: ${m.Status}`,
    `Flow: ${m.IntegrationFlowName ?? "n/a"}`,
    `Sender: ${m.Sender ?? "n/a"} -> Receiver: ${m.Receiver ?? "n/a"}`,
    `Start: ${m.LogStart ?? "n/a"} | End: ${m.LogEnd ?? "n/a"}`,
  ];
  if (m.AlternateWebLink) lines.push(`Link: ${m.AlternateWebLink}`);
  return lines.join("\n");
}

function toQueryString(params: ODataParams): string {
  const entries = Object.entries(params);
  if (entries.length === 0) return "";
  return (
    "?" +
    entries
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join("&")
  );
}

async function countMessages(
  context: ModuleContext,
  filters: Omit<ListMessagesFilters, "top">
): Promise<string> {
  return context.odataClient.getValue(
    `${API_PATH}/$count${toQueryString(buildCountParams(filters))}`
  );
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
          customStatus: z
            .string()
            .optional()
            .describe(CUSTOM_STATUS_DESCRIPTION),
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
      textTool(async (filters) => {
        const params = buildListMessagesParams(filters);
        const messages =
          await context.odataClient.getCollection<MessageProcessingLog>(
            API_PATH,
            params
          );
        if (messages.length === 0) {
          return "No messages found matching the given filters.";
        }
        const text = messages.map(formatMessage).join("\n---\n");
        return `Found ${messages.length} message(s):\n\n${text}`;
      })
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
      textTool(async ({ messageGuid }) => {
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

        return sections.join("\n\n");
      })
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
          customStatus: z
            .string()
            .optional()
            .describe(CUSTOM_STATUS_DESCRIPTION),
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
      textTool(async (filters) => {
        const count = await countMessages(context, filters);
        return `Message count: ${count}`;
      })
    );

    // --- aggregate_messages ---
    // @api GET /MessageProcessingLogs
    // @api GET /MessageProcessingLogs/$count
    server.registerTool(
      "aggregate_messages",
      {
        description:
          "Group message processing logs by flow/status/customStatus/sender/receiver and return counts per group. " +
          "Use this for 'top failing flows', 'errors per flow' or 'distribution per status' questions instead of paginating list_messages. " +
          "Pages through the logs selecting only the grouped field, then aggregates in memory.",
        inputSchema: z.object({
          groupBy: z
            .enum(["flowName", "status", "customStatus", "sender", "receiver"])
            .optional()
            .describe("Field to group by (default: flowName)"),
          status: z
            .string()
            .optional()
            .describe(
              "Filter by status (COMPLETED, FAILED, PROCESSING, RETRY, etc.)"
            ),
          customStatus: z
            .string()
            .optional()
            .describe(CUSTOM_STATUS_DESCRIPTION),
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
            .describe("Max number of groups to return (default 20)"),
          maxScan: z
            .number()
            .optional()
            .describe(
              "Maximum messages to scan across pages (default 20000, hard cap 100000). " +
                "If more messages match, results are based on the most recent maxScan messages."
            ),
        }),
      },
      textTool(async ({ groupBy = "flowName", top, maxScan, ...filters }) => {
        const odataField = AGGREGATE_FIELD_TO_ODATA[groupBy];
        const topGroups = top ?? 20;
        const scanLimit = Math.min(maxScan ?? 20000, 100000);
        const PAGE_SIZE = 1000;

        const total = parseInt(await countMessages(context, filters), 10) || 0;
        if (total === 0) {
          return "No messages found matching the given filters.";
        }

        const counts = new Map<string, number>();
        const limit = Math.min(total, scanLimit);
        let scanned = 0;
        while (scanned < limit) {
          const pageSize = Math.min(PAGE_SIZE, limit - scanned);
          const page = await context.odataClient.getCollection<Record<string, unknown>>(
            API_PATH,
            buildAggregateParams(filters, groupBy, pageSize, scanned)
          );
          if (page.length === 0) break;
          for (const row of page) {
            const key = (row[odataField] as string | null | undefined) ?? "(unknown)";
            counts.set(key, (counts.get(key) ?? 0) + 1);
          }
          scanned += page.length;
          if (page.length < pageSize) break;
        }

        const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
        const shown = sorted.slice(0, topGroups);
        const keyWidth = Math.max(...shown.map(([k]) => k.length), 5);

        const lines = [
          `Aggregation by ${groupBy} (${odataField})`,
          `Total messages matched: ${total}`,
          `Messages scanned: ${scanned}${scanned < total ? " (truncated — increase maxScan or narrow filters for full coverage)" : ""}`,
          `Distinct groups: ${counts.size}`,
          `Showing top ${shown.length} of ${sorted.length}`,
          "",
          `  Count   ${groupBy.padEnd(keyWidth)}`,
          `  -----   ${"-".repeat(keyWidth)}`,
          ...shown.map(([key, c]) => `  ${String(c).padStart(5)}   ${key}`),
        ];
        if (sorted.length > topGroups) {
          const rest = sorted.slice(topGroups).reduce((sum, [, c]) => sum + c, 0);
          lines.push(`  ${String(rest).padStart(5)}   (${sorted.length - topGroups} other groups)`);
        }
        return lines.join("\n");
      })
    );

    // --- list_messages_with_headers ---
    // @api GET /MessageProcessingLogs
    // @api GET /MessageProcessingLogs('{MessageGuid}')/CustomHeaderProperties
    server.registerTool(
      "list_messages_with_headers",
      {
        description:
          "List message processing logs and include their CustomHeaderProperties inline. " +
          "Same filters as list_messages, but additionally fetches CustomHeaderProperties per message in parallel " +
          "(SAP CPI does not support $expand=CustomHeaderProperties on the MPL collection). " +
          "Use when you need to read or aggregate custom header values across many messages without n+1 get_message calls.",
        inputSchema: z.object({
          status: z
            .string()
            .optional()
            .describe(
              "Filter by status (COMPLETED, FAILED, PROCESSING, RETRY, etc.)"
            ),
          customStatus: z
            .string()
            .optional()
            .describe(CUSTOM_STATUS_DESCRIPTION),
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
          headerNames: z
            .array(z.string())
            .optional()
            .describe(
              "Optional whitelist of custom header names to include in the output. If omitted, all headers are returned."
            ),
          concurrency: z
            .number()
            .optional()
            .describe("Parallel fetches for CustomHeaderProperties (default 20, max 50)"),
        }),
      },
      textTool(async ({ headerNames, concurrency, ...filters }) => {
        const messages = await context.odataClient.getCollection<MessageProcessingLog>(
          API_PATH,
          buildListMessagesParams(filters)
        );
        if (messages.length === 0) {
          return "No messages found matching the given filters.";
        }

        const workers = Math.min(Math.max(concurrency ?? 20, 1), 50, messages.length);
        const whitelist = headerNames && headerNames.length > 0 ? new Set(headerNames) : null;
        const headersByGuid = new Map<string, CustomHeaderProperty[] | Error>();

        let cursor = 0;
        const worker = async () => {
          while (cursor < messages.length) {
            const guid = messages[cursor++].MessageGuid;
            try {
              headersByGuid.set(
                guid,
                await context.odataClient.getCollection<CustomHeaderProperty>(
                  `${API_PATH}('${guid}')/CustomHeaderProperties`
                )
              );
            } catch (err) {
              headersByGuid.set(guid, err instanceof Error ? err : new Error(String(err)));
            }
          }
        };
        await Promise.all(Array.from({ length: workers }, worker));

        let errorCount = 0;
        const sections = messages.map((m) => {
          const lines = [formatMessage(m)];
          const result = headersByGuid.get(m.MessageGuid);
          if (result instanceof Error) {
            errorCount++;
            lines.push(`Custom Headers: (error: ${result.message})`);
          } else if (result && result.length > 0) {
            const filtered = whitelist
              ? result.filter((h) => h.Name && whitelist.has(h.Name))
              : result;
            if (filtered.length > 0) {
              lines.push(
                "Custom Headers:\n" +
                  filtered.map((h) => `  ${h.Name ?? h.Id}: ${h.Value ?? "n/a"}`).join("\n")
              );
            } else {
              lines.push("Custom Headers: (none of the requested names set)");
            }
          } else {
            lines.push("Custom Headers: (none)");
          }
          return lines.join("\n");
        });

        const errors = errorCount > 0 ? ` (${errorCount} header fetch error(s))` : "";
        return `Found ${messages.length} message(s)${errors}:\n\n${sections.join("\n---\n")}`;
      })
    );

    // --- get_errors ---
    // @api GET /MessageProcessingLogs
    // @api GET /MessageProcessingLogs('{MessageGuid}')/ErrorInformation/$value
    server.registerTool(
      "get_errors",
      {
        description:
          "Get recent failed messages grouped by integration flow, with error counts and one sample error per flow. Capped at the 200 most recent failures; use aggregate_messages for exact totals.",
        inputSchema: z.object({
          from: z
            .string()
            .optional()
            .describe(
              "Start time (ISO 8601). Defaults to 1 hour ago."
            ),
          customStatus: z
            .string()
            .optional()
            .describe(
              "Optionally narrow by custom status (e.g. ERROR, ESCALATED) in addition to Status='FAILED'."
            ),
        }),
      },
      textTool(async (filters) => {
        const params = buildGetErrorsParams(filters);
        const messages =
          await context.odataClient.getCollection<MessageProcessingLog>(
            API_PATH,
            params
          );

        if (messages.length === 0) {
          return "No failed messages found in the given time range.";
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
        ];
        if (messages.length >= 200) {
          lines.push(
            "Note: result is capped at 200 messages (most recent first); the real total may be higher. Use aggregate_messages with status FAILED for the exact count."
          );
        }
        lines.push(`Affected flows: ${groups.size}`, "");

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

        return lines.join("\n");
      })
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
      textTool(async ({ messageGuid, attachmentId }) => {
        const MAX_SIZE = 100 * 1024;
        if (attachmentId) {
          const content = await context.odataClient.getValue(
            `${API_PATH}('${messageGuid}')/Attachments('${attachmentId}')/$value`
          );
          const text =
            content.length > MAX_SIZE
              ? `${content.slice(0, MAX_SIZE)}\n\n[Truncated: original size ${content.length} chars]`
              : content;
          return text;
        }

        const attachments =
          await context.odataClient.getCollection<MessageProcessingLogAttachment>(
            `${API_PATH}('${messageGuid}')/Attachments`
          );

        if (attachments.length === 0) {
          return "No attachments found for this message.";
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

        return `Found ${attachments.length} attachment(s):\n\n${lines.join("\n---\n")}`;
      })
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
      textTool(async ({ messageGuid }) => {
        const entity = await context.odataClient.getEntity<ErrorInformation>(
          buildErrorInformationPath(messageGuid)
        );
        const lines = [
          `MessageGuid: ${entity.MessageGuid}`,
          `Type: ${entity.Type ?? "n/a"}`,
          `LastErrorModelStepId: ${entity.LastErrorModelStepId ?? "n/a"}`,
        ];
        return lines.join("\n");
      })
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
      textTool(async ({ messageGuid, entryId }) => {
        const MAX_SIZE = 100 * 1024;
        if (entryId) {
          const content = await context.odataClient.getValue(
            `${API_PATH}('${messageGuid}')/MessageStoreEntries('${entryId}')/$value`
          );
          const text =
            content.length > MAX_SIZE
              ? `${content.slice(0, MAX_SIZE)}\n\n[Truncated: original size ${content.length} chars]`
              : content;
          return text;
        }

        const entries =
          await context.odataClient.getCollection<MessageStoreEntry>(
            `${API_PATH}('${messageGuid}')/MessageStoreEntries`
          );

        if (entries.length === 0) {
          return "No message store entries found for this message.";
        }

        const lines = entries.map((e) =>
          [
            `Id: ${e.Id}`,
            `StoreId: ${e.MessageStoreId ?? "n/a"}`,
            `Time: ${e.TimeStamp ?? "n/a"}`,
            `HasAttachments: ${e.HasAttachments ?? "n/a"}`,
          ].join("\n")
        );

        return `Found ${entries.length} message store entr${entries.length === 1 ? "y" : "ies"}:\n\n${lines.join("\n---\n")}`;
      })
    );
  },
};

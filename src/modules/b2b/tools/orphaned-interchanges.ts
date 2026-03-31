import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type { ModuleContext } from "../../../core/types.js";
import type {
  OrphanedInterchange,
  ErrorDetail,
  BusinessDocumentProcessingEvent,
  BusinessDocumentPayload,
  BusinessDocumentProtocolHeader,
} from "../types.js";
import {
  buildOrphanedInterchangesPath,
  buildOrphanedInterchangePath,
  buildOrphanedInterchangesCountPath,
  buildOrphanedInterchangeErrorDetailsPath,
  buildOrphanedInterchangeEventsPath,
  buildOrphanedInterchangePayloadsPath,
  buildOrphanedInterchangeHeadersPath,
} from "../queries.js";

function parseODataDate(value: string | null): string {
  if (!value) return "n/a";
  const match = value.match(/\/Date\((\d+)\)\//);
  if (match) return new Date(parseInt(match[1])).toISOString();
  return value;
}

function formatOrphanedInterchange(o: OrphanedInterchange): string {
  const lines: string[] = [];
  lines.push(`Id: ${o.Id ?? "n/a"}`);
  lines.push(`AdapterType: ${o.AdapterType ?? "n/a"}`);
  lines.push(`Date: ${parseODataDate(o.Date)}`);
  return lines.join("\n");
}

function formatErrorDetail(e: ErrorDetail): string {
  const lines: string[] = [];
  lines.push(`Id: ${e.Id ?? "n/a"}`);
  lines.push(`ErrorCategory: ${e.ErrorCategory ?? "n/a"}`);
  lines.push(`ErrorMessage: ${e.ErrorMessage ?? "n/a"}`);
  return lines.join("\n");
}

function formatEvent(e: BusinessDocumentProcessingEvent): string {
  const lines: string[] = [];
  lines.push(`Id: ${e.Id ?? "n/a"}`);
  lines.push(`EventType: ${e.EventType ?? "n/a"}`);
  lines.push(`Date: ${parseODataDate(e.Date)}`);
  lines.push(`MonitoringType: ${e.MonitoringType ?? "n/a"}`);
  lines.push(`MonitoringId: ${e.MonitoringId ?? "n/a"}`);
  return lines.join("\n");
}

function formatPayload(p: BusinessDocumentPayload): string {
  const lines: string[] = [];
  lines.push(`Id: ${p.Id ?? "n/a"}`);
  lines.push(`ProcessingState: ${p.ProcessingState ?? "n/a"}`);
  lines.push(`Direction: ${p.Direction ?? "n/a"}`);
  lines.push(`PayloadId: ${p.PayloadId ?? "n/a"}`);
  lines.push(`PayloadContainerContentType: ${p.PayloadContainerContentType ?? "n/a"}`);
  lines.push(`PayloadContentType: ${p.PayloadContentType ?? "n/a"}`);
  lines.push(`ArchivingRelevant: ${p.ArchivingRelevant ?? "n/a"}`);
  return lines.join("\n");
}

function formatHeader(h: BusinessDocumentProtocolHeader): string {
  const lines: string[] = [];
  lines.push(`Id: ${h.Id ?? "n/a"}`);
  lines.push(`Name: ${h.Name ?? "n/a"}`);
  lines.push(`Value: ${h.Value ?? "n/a"}`);
  return lines.join("\n");
}

export function registerOrphanedInterchangeTools(
  server: McpServer,
  context: ModuleContext
) {
  // 1. list_orphaned_interchanges
  server.registerTool(
    "list_orphaned_interchanges",
    {
      description:
        "List orphaned (unassigned) interchange documents on the active SAP Cloud Integration tenant. Supports OData query options for filtering, sorting, pagination, and inline count.",
      inputSchema: z.object({
        filter: z
          .string()
          .optional()
          .describe("OData $filter expression, e.g. \"AdapterType eq 'AS2'\""),
        orderby: z
          .string()
          .optional()
          .describe("OData $orderby expression, e.g. \"Date desc\""),
        select: z
          .string()
          .optional()
          .describe("OData $select fields, e.g. \"Id,AdapterType,Date\""),
        expand: z
          .string()
          .optional()
          .describe(
            "OData $expand for related entities, e.g. \"ErrorDetails,BusinessDocumentProcessingEvent\""
          ),
        top: z
          .number()
          .optional()
          .describe("Maximum number of results to return"),
        skip: z
          .number()
          .optional()
          .describe("Number of results to skip (for pagination)"),
        inlinecount: z
          .string()
          .optional()
          .describe("Set to 'allpages' to include total count in response"),
      }),
    },
    async ({ filter, orderby, select, expand, top, skip, inlinecount }) => {
      try {
        const interchanges =
          await context.odataClient.getCollection<OrphanedInterchange>(
            buildOrphanedInterchangesPath(),
            {
              $filter: filter,
              $orderby: orderby,
              $select: select,
              $expand: expand,
              $top: top,
              $skip: skip,
              $inlinecount: inlinecount,
            }
          );
        if (interchanges.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: "No orphaned interchanges found.",
              },
            ],
          };
        }
        const text = interchanges.map(formatOrphanedInterchange).join("\n\n");
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

  // 2. get_orphaned_interchange
  server.registerTool(
    "get_orphaned_interchange",
    {
      description:
        "Get details of a specific orphaned interchange document by its ID.",
      inputSchema: z.object({
        id: z
          .string()
          .describe("The GUID of the orphaned interchange document"),
        select: z
          .string()
          .optional()
          .describe("OData $select fields, e.g. \"Id,AdapterType,Date\""),
        expand: z
          .string()
          .optional()
          .describe(
            "OData $expand for related entities, e.g. \"ErrorDetails,BusinessDocumentPayloads\""
          ),
      }),
    },
    async ({ id, select, expand }) => {
      try {
        const interchange =
          await context.odataClient.getEntity<OrphanedInterchange>(
            buildOrphanedInterchangePath(id),
            {
              $select: select,
              $expand: expand,
            }
          );
        const text = formatOrphanedInterchange(interchange);
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

  // 3. count_orphaned_interchanges
  server.registerTool(
    "count_orphaned_interchanges",
    {
      description:
        "Count orphaned interchange documents. Optionally filter by OData filter expression.",
      inputSchema: z.object({
        filter: z
          .string()
          .optional()
          .describe(
            "OData $filter expression, e.g. \"AdapterType eq 'AS2'\""
          ),
      }),
    },
    async ({ filter }) => {
      try {
        const path = filter
          ? `${buildOrphanedInterchangesCountPath()}?$filter=${encodeURIComponent(filter)}`
          : buildOrphanedInterchangesCountPath();
        const count = await context.odataClient.getValue(path);
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

  // 4. get_orphaned_interchange_errors
  server.registerTool(
    "get_orphaned_interchange_errors",
    {
      description:
        "Get error details for an orphaned interchange document by its ID.",
      inputSchema: z.object({
        id: z
          .string()
          .describe("The GUID of the orphaned interchange document"),
      }),
    },
    async ({ id }) => {
      try {
        const errors =
          await context.odataClient.getCollection<ErrorDetail>(
            buildOrphanedInterchangeErrorDetailsPath(id)
          );
        if (errors.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: "No error details found for this orphaned interchange.",
              },
            ],
          };
        }
        const text = errors.map(formatErrorDetail).join("\n\n");
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

  // 5. get_orphaned_interchange_events
  server.registerTool(
    "get_orphaned_interchange_events",
    {
      description:
        "Get processing events for an orphaned interchange document by its ID.",
      inputSchema: z.object({
        id: z
          .string()
          .describe("The GUID of the orphaned interchange document"),
        select: z
          .string()
          .optional()
          .describe(
            "OData $select fields, e.g. \"Id,EventType,Date,MonitoringType\""
          ),
        expand: z
          .string()
          .optional()
          .describe(
            "OData $expand for related entities, e.g. \"BusinessDocument,ErrorDetails\""
          ),
      }),
    },
    async ({ id, select, expand }) => {
      try {
        const events =
          await context.odataClient.getCollection<BusinessDocumentProcessingEvent>(
            buildOrphanedInterchangeEventsPath(id),
            {
              $select: select,
              $expand: expand,
            }
          );
        if (events.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: "No processing events found for this orphaned interchange.",
              },
            ],
          };
        }
        const text = events.map(formatEvent).join("\n\n");
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

  // 6. get_orphaned_interchange_payloads
  server.registerTool(
    "get_orphaned_interchange_payloads",
    {
      description:
        "Get payloads for an orphaned interchange document by its ID.",
      inputSchema: z.object({
        id: z
          .string()
          .describe("The GUID of the orphaned interchange document"),
        select: z
          .string()
          .optional()
          .describe(
            "OData $select fields, e.g. \"Id,PayloadId,PayloadContentType\""
          ),
        expand: z
          .string()
          .optional()
          .describe(
            "OData $expand for related entities, e.g. \"BusinessDocumentProcessingEvent\""
          ),
      }),
    },
    async ({ id, select, expand }) => {
      try {
        const payloads =
          await context.odataClient.getCollection<BusinessDocumentPayload>(
            buildOrphanedInterchangePayloadsPath(id),
            {
              $select: select,
              $expand: expand,
            }
          );
        if (payloads.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: "No payloads found for this orphaned interchange.",
              },
            ],
          };
        }
        const text = payloads.map(formatPayload).join("\n\n");
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

  // 7. get_orphaned_interchange_headers
  server.registerTool(
    "get_orphaned_interchange_headers",
    {
      description:
        "Get protocol headers for an orphaned interchange document by its ID.",
      inputSchema: z.object({
        id: z
          .string()
          .describe("The GUID of the orphaned interchange document"),
        select: z
          .string()
          .optional()
          .describe("OData $select fields, e.g. \"Id,Name,Value\""),
        expand: z
          .string()
          .optional()
          .describe(
            "OData $expand for related entities, e.g. \"OrphanedInterchange\""
          ),
      }),
    },
    async ({ id, select, expand }) => {
      try {
        const headers =
          await context.odataClient.getCollection<BusinessDocumentProtocolHeader>(
            buildOrphanedInterchangeHeadersPath(id),
            {
              $select: select,
              $expand: expand,
            }
          );
        if (headers.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: "No protocol headers found for this orphaned interchange.",
              },
            ],
          };
        }
        const text = headers.map(formatHeader).join("\n\n");
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

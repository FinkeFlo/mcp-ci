import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type { ModuleContext } from "../../../core/types.js";
import type {
  BusinessDocument,
  BusinessDocumentProcessingEvent,
  BusinessDocumentPayload,
  BusinessDocumentNote,
  BusinessDocumentExtField,
  BusinessDocumentProtocolHeader,
  CustomSearchAttribute,
  ErrorDetail,
  TechnicalAcknowledgement,
  FunctionalAcknowledgement,
} from "../types.js";
import {
  buildBusinessDocumentsPath,
  buildBusinessDocumentPath,
  buildBusinessDocumentsCountPath,
  buildBusinessDocSenderTechAckPath,
  buildBusinessDocReceiverTechAckPath,
  buildBusinessDocSenderFuncAckPath,
  buildBusinessDocReceiverFuncAckPath,
  buildBusinessDocEventsPath,
  buildBusinessDocPayloadsPath,
  buildBusinessDocPayloadValuePath,
  buildBusinessDocNotesPath,
  buildBusinessDocCustomObjectsPath,
  buildBusinessDocExtFieldsPath,
  buildBusinessDocLastErrorPath,
  buildBusinessDocHeadersPath,
  buildTechnicalAckPath,
  buildTechnicalAckValuePath,
  buildFunctionalAckPath,
  buildFunctionalAckValuePath,
} from "../queries.js";

function parseODataDate(value: string | null): string {
  if (!value) return "n/a";
  const match = value.match(/\/Date\((\d+)\)\//);
  if (match) return new Date(parseInt(match[1])).toISOString();
  return value;
}

function formatBusinessDocument(d: BusinessDocument): string {
  const lines: string[] = [];
  lines.push(`Id: ${d.Id ?? "n/a"}`);
  lines.push(`SenderTradingPartnerName: ${d.SenderTradingPartnerName ?? "n/a"}`);
  lines.push(`ReceiverTradingPartnerName: ${d.ReceiverTradingPartnerName ?? "n/a"}`);
  lines.push(`ProcessingStatus: ${d.ProcessingStatus ?? "n/a"}`);
  lines.push(`OverallStatus: ${d.OverallStatus ?? "n/a"}`);
  lines.push(`StartedAt: ${parseODataDate(d.StartedAt)}`);
  lines.push(`EndedAt: ${parseODataDate(d.EndedAt)}`);
  lines.push(`DocumentCreationTime: ${parseODataDate(d.DocumentCreationTime)}`);
  return lines.join("\n");
}

function formatTechnicalAck(a: TechnicalAcknowledgement): string {
  const lines: string[] = [];
  lines.push(`Id: ${a.Id ?? "n/a"}`);
  lines.push(`Type: ${a.Type ?? "n/a"}`);
  lines.push(`Direction: ${a.Direction ?? "n/a"}`);
  lines.push(`PayloadId: ${a.PayloadId ?? "n/a"}`);
  lines.push(`Status: ${a.Status ?? "n/a"}`);
  lines.push(`PayloadContainerContentType: ${a.PayloadContainerContentType ?? "n/a"}`);
  lines.push(`PayloadContentType: ${a.PayloadContentType ?? "n/a"}`);
  return lines.join("\n");
}

function formatFunctionalAck(a: FunctionalAcknowledgement): string {
  const lines: string[] = [];
  lines.push(`Id: ${a.Id ?? "n/a"}`);
  lines.push(`Type: ${a.Type ?? "n/a"}`);
  lines.push(`Direction: ${a.Direction ?? "n/a"}`);
  lines.push(`PayloadId: ${a.PayloadId ?? "n/a"}`);
  lines.push(`Status: ${a.Status ?? "n/a"}`);
  lines.push(`PayloadContainerContentType: ${a.PayloadContainerContentType ?? "n/a"}`);
  lines.push(`PayloadContentType: ${a.PayloadContentType ?? "n/a"}`);
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
  return lines.join("\n");
}

function formatNote(n: BusinessDocumentNote): string {
  const lines: string[] = [];
  lines.push(`Id: ${n.Id ?? "n/a"}`);
  lines.push(`User: ${n.User ?? "n/a"}`);
  lines.push(`CreatedAt: ${parseODataDate(n.CreatedAt)}`);
  lines.push(`NoteContent: ${n.NoteContent ?? "n/a"}`);
  return lines.join("\n");
}

function formatCustomSearchAttribute(a: CustomSearchAttribute): string {
  const lines: string[] = [];
  lines.push(`Id: ${a.Id ?? "n/a"}`);
  lines.push(`Name: ${a.Name ?? "n/a"}`);
  lines.push(`Value: ${a.Value ?? "n/a"}`);
  return lines.join("\n");
}

function formatExtField(f: BusinessDocumentExtField): string {
  const lines: string[] = [];
  lines.push(`Id: ${f.Id ?? "n/a"}`);
  lines.push(`Name: ${f.Name ?? "n/a"}`);
  lines.push(`Value: ${f.Value ?? "n/a"}`);
  return lines.join("\n");
}

function formatErrorDetail(e: ErrorDetail): string {
  const lines: string[] = [];
  lines.push(`Id: ${e.Id ?? "n/a"}`);
  lines.push(`ErrorCategory: ${e.ErrorCategory ?? "n/a"}`);
  lines.push(`ErrorMessage: ${e.ErrorMessage ?? "n/a"}`);
  return lines.join("\n");
}

function formatHeader(h: BusinessDocumentProtocolHeader): string {
  const lines: string[] = [];
  lines.push(`Id: ${h.Id ?? "n/a"}`);
  lines.push(`Name: ${h.Name ?? "n/a"}`);
  lines.push(`Value: ${h.Value ?? "n/a"}`);
  return lines.join("\n");
}

export function registerBusinessDocumentTools(
  server: McpServer,
  context: ModuleContext
) {
  // 1. list_business_documents
  server.registerTool(
    "list_business_documents",
    {
      description:
        "List B2B business documents on the active SAP Cloud Integration tenant. Supports OData query options for filtering, sorting, pagination, and inline count.",
      inputSchema: z.object({
        filter: z
          .string()
          .optional()
          .describe("OData $filter expression, e.g. \"ProcessingStatus eq 'COMPLETED'\""),
        orderby: z
          .string()
          .optional()
          .describe("OData $orderby expression, e.g. \"StartedAt desc\""),
        select: z
          .string()
          .optional()
          .describe("OData $select fields, e.g. \"Id,ProcessingStatus,OverallStatus\""),
        expand: z
          .string()
          .optional()
          .describe("OData $expand navigation properties"),
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
        const docs =
          await context.odataClient.getCollection<BusinessDocument>(
            buildBusinessDocumentsPath(),
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
        if (docs.length === 0) {
          return {
            content: [
              { type: "text" as const, text: "No business documents found." },
            ],
          };
        }
        const text = docs.map(formatBusinessDocument).join("\n\n");
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

  // 2. get_business_document
  server.registerTool(
    "get_business_document",
    {
      description:
        "Get details of a specific B2B business document by its ID.",
      inputSchema: z.object({
        id: z.string().describe("The business document ID (GUID)"),
        select: z
          .string()
          .optional()
          .describe("OData $select fields"),
        expand: z
          .string()
          .optional()
          .describe("OData $expand navigation properties"),
      }),
    },
    async ({ id, select, expand }) => {
      try {
        const doc =
          await context.odataClient.getEntity<BusinessDocument>(
            buildBusinessDocumentPath(id),
            {
              $select: select,
              $expand: expand,
            }
          );
        const text = formatBusinessDocument(doc);
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

  // 3. count_business_documents
  server.registerTool(
    "count_business_documents",
    {
      description:
        "Count B2B business documents. Optionally filter by OData filter expression.",
      inputSchema: z.object({
        filter: z
          .string()
          .optional()
          .describe("OData $filter expression, e.g. \"ProcessingStatus eq 'ERROR'\""),
      }),
    },
    async ({ filter }) => {
      try {
        const path = filter
          ? `${buildBusinessDocumentsCountPath()}?$filter=${encodeURIComponent(filter)}`
          : buildBusinessDocumentsCountPath();
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

  // 4. get_sender_technical_ack
  server.registerTool(
    "get_sender_technical_ack",
    {
      description:
        "Get the sender technical acknowledgement of a B2B business document.",
      inputSchema: z.object({
        id: z.string().describe("The business document ID (GUID)"),
        select: z
          .string()
          .optional()
          .describe("OData $select fields"),
        expand: z
          .string()
          .optional()
          .describe("OData $expand navigation properties"),
      }),
    },
    async ({ id, select, expand }) => {
      try {
        const ack =
          await context.odataClient.getEntity<TechnicalAcknowledgement>(
            buildBusinessDocSenderTechAckPath(id),
            {
              $select: select,
              $expand: expand,
            }
          );
        const text = formatTechnicalAck(ack);
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

  // 5. get_receiver_technical_ack
  server.registerTool(
    "get_receiver_technical_ack",
    {
      description:
        "Get the receiver technical acknowledgement of a B2B business document.",
      inputSchema: z.object({
        id: z.string().describe("The business document ID (GUID)"),
        select: z
          .string()
          .optional()
          .describe("OData $select fields"),
        expand: z
          .string()
          .optional()
          .describe("OData $expand navigation properties"),
      }),
    },
    async ({ id, select, expand }) => {
      try {
        const ack =
          await context.odataClient.getEntity<TechnicalAcknowledgement>(
            buildBusinessDocReceiverTechAckPath(id),
            {
              $select: select,
              $expand: expand,
            }
          );
        const text = formatTechnicalAck(ack);
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

  // 6. get_sender_functional_ack
  server.registerTool(
    "get_sender_functional_ack",
    {
      description:
        "Get the sender functional acknowledgement of a B2B business document.",
      inputSchema: z.object({
        id: z.string().describe("The business document ID (GUID)"),
        select: z
          .string()
          .optional()
          .describe("OData $select fields"),
        expand: z
          .string()
          .optional()
          .describe("OData $expand navigation properties"),
      }),
    },
    async ({ id, select, expand }) => {
      try {
        const ack =
          await context.odataClient.getEntity<FunctionalAcknowledgement>(
            buildBusinessDocSenderFuncAckPath(id),
            {
              $select: select,
              $expand: expand,
            }
          );
        const text = formatFunctionalAck(ack);
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

  // 7. get_receiver_functional_ack
  server.registerTool(
    "get_receiver_functional_ack",
    {
      description:
        "Get the receiver functional acknowledgement of a B2B business document.",
      inputSchema: z.object({
        id: z.string().describe("The business document ID (GUID)"),
        select: z
          .string()
          .optional()
          .describe("OData $select fields"),
        expand: z
          .string()
          .optional()
          .describe("OData $expand navigation properties"),
      }),
    },
    async ({ id, select, expand }) => {
      try {
        const ack =
          await context.odataClient.getEntity<FunctionalAcknowledgement>(
            buildBusinessDocReceiverFuncAckPath(id),
            {
              $select: select,
              $expand: expand,
            }
          );
        const text = formatFunctionalAck(ack);
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

  // 8. get_business_document_events
  server.registerTool(
    "get_business_document_events",
    {
      description:
        "Get processing events of a B2B business document.",
      inputSchema: z.object({
        id: z.string().describe("The business document ID (GUID)"),
        select: z
          .string()
          .optional()
          .describe("OData $select fields"),
        expand: z
          .string()
          .optional()
          .describe("OData $expand navigation properties"),
      }),
    },
    async ({ id, select, expand }) => {
      try {
        const events =
          await context.odataClient.getCollection<BusinessDocumentProcessingEvent>(
            buildBusinessDocEventsPath(id),
            {
              $select: select,
              $expand: expand,
            }
          );
        if (events.length === 0) {
          return {
            content: [
              { type: "text" as const, text: "No processing events found." },
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

  // 9. get_business_document_payloads
  server.registerTool(
    "get_business_document_payloads",
    {
      description:
        "Get payloads of a B2B business document.",
      inputSchema: z.object({
        id: z.string().describe("The business document ID (GUID)"),
        select: z
          .string()
          .optional()
          .describe("OData $select fields"),
        expand: z
          .string()
          .optional()
          .describe("OData $expand navigation properties"),
      }),
    },
    async ({ id, select, expand }) => {
      try {
        const payloads =
          await context.odataClient.getCollection<BusinessDocumentPayload>(
            buildBusinessDocPayloadsPath(id),
            {
              $select: select,
              $expand: expand,
            }
          );
        if (payloads.length === 0) {
          return {
            content: [
              { type: "text" as const, text: "No payloads found." },
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

  // 10. download_business_document_payload
  server.registerTool(
    "download_business_document_payload",
    {
      description:
        "Download the payload content of a B2B business document payload by its payload ID.",
      inputSchema: z.object({
        payloadId: z.string().describe("The payload ID"),
      }),
    },
    async ({ payloadId }) => {
      try {
        const content = await context.odataClient.getValue(
          buildBusinessDocPayloadValuePath(payloadId)
        );
        if (!content) {
          return {
            content: [
              { type: "text" as const, text: "No payload content available." },
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

  // 11. get_business_document_notes
  server.registerTool(
    "get_business_document_notes",
    {
      description:
        "Get notes of a B2B business document.",
      inputSchema: z.object({
        id: z.string().describe("The business document ID (GUID)"),
        select: z
          .string()
          .optional()
          .describe("OData $select fields"),
        expand: z
          .string()
          .optional()
          .describe("OData $expand navigation properties"),
      }),
    },
    async ({ id, select, expand }) => {
      try {
        const notes =
          await context.odataClient.getCollection<BusinessDocumentNote>(
            buildBusinessDocNotesPath(id),
            {
              $select: select,
              $expand: expand,
            }
          );
        if (notes.length === 0) {
          return {
            content: [
              { type: "text" as const, text: "No notes found." },
            ],
          };
        }
        const text = notes.map(formatNote).join("\n\n");
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

  // 12. get_business_document_custom_objects
  server.registerTool(
    "get_business_document_custom_objects",
    {
      description:
        "Get custom search attributes (custom objects) of a B2B business document.",
      inputSchema: z.object({
        id: z.string().describe("The business document ID (GUID)"),
        select: z
          .string()
          .optional()
          .describe("OData $select fields"),
        expand: z
          .string()
          .optional()
          .describe("OData $expand navigation properties"),
      }),
    },
    async ({ id, select, expand }) => {
      try {
        const attrs =
          await context.odataClient.getCollection<CustomSearchAttribute>(
            buildBusinessDocCustomObjectsPath(id),
            {
              $select: select,
              $expand: expand,
            }
          );
        if (attrs.length === 0) {
          return {
            content: [
              { type: "text" as const, text: "No custom search attributes found." },
            ],
          };
        }
        const text = attrs.map(formatCustomSearchAttribute).join("\n\n");
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

  // 13. get_business_document_ext_fields
  server.registerTool(
    "get_business_document_ext_fields",
    {
      description:
        "Get extended fields of a B2B business document.",
      inputSchema: z.object({
        id: z.string().describe("The business document ID (GUID)"),
        select: z
          .string()
          .optional()
          .describe("OData $select fields"),
        expand: z
          .string()
          .optional()
          .describe("OData $expand navigation properties"),
      }),
    },
    async ({ id, select, expand }) => {
      try {
        const fields =
          await context.odataClient.getCollection<BusinessDocumentExtField>(
            buildBusinessDocExtFieldsPath(id),
            {
              $select: select,
              $expand: expand,
            }
          );
        if (fields.length === 0) {
          return {
            content: [
              { type: "text" as const, text: "No extended fields found." },
            ],
          };
        }
        const text = fields.map(formatExtField).join("\n\n");
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

  // 14. get_business_document_last_error
  server.registerTool(
    "get_business_document_last_error",
    {
      description:
        "Get the last error details of a B2B business document.",
      inputSchema: z.object({
        id: z.string().describe("The business document ID (GUID)"),
        select: z
          .string()
          .optional()
          .describe("OData $select fields"),
        expand: z
          .string()
          .optional()
          .describe("OData $expand navigation properties"),
      }),
    },
    async ({ id, select, expand }) => {
      try {
        const errors =
          await context.odataClient.getCollection<ErrorDetail>(
            buildBusinessDocLastErrorPath(id),
            {
              $select: select,
              $expand: expand,
            }
          );
        if (errors.length === 0) {
          return {
            content: [
              { type: "text" as const, text: "No error details found." },
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

  // 15. get_business_document_headers
  server.registerTool(
    "get_business_document_headers",
    {
      description:
        "Get protocol headers of a B2B business document.",
      inputSchema: z.object({
        id: z.string().describe("The business document ID (GUID)"),
        select: z
          .string()
          .optional()
          .describe("OData $select fields"),
        expand: z
          .string()
          .optional()
          .describe("OData $expand navigation properties"),
      }),
    },
    async ({ id, select, expand }) => {
      try {
        const headers =
          await context.odataClient.getCollection<BusinessDocumentProtocolHeader>(
            buildBusinessDocHeadersPath(id),
            {
              $select: select,
              $expand: expand,
            }
          );
        if (headers.length === 0) {
          return {
            content: [
              { type: "text" as const, text: "No protocol headers found." },
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

  // 16. get_technical_acknowledgement
  server.registerTool(
    "get_technical_acknowledgement",
    {
      description:
        "Get a standalone technical acknowledgement by its ID.",
      inputSchema: z.object({
        id: z.string().describe("The technical acknowledgement ID"),
        select: z
          .string()
          .optional()
          .describe("OData $select fields"),
        expand: z
          .string()
          .optional()
          .describe("OData $expand navigation properties"),
      }),
    },
    async ({ id, select, expand }) => {
      try {
        const ack =
          await context.odataClient.getEntity<TechnicalAcknowledgement>(
            buildTechnicalAckPath(id),
            {
              $select: select,
              $expand: expand,
            }
          );
        const text = formatTechnicalAck(ack);
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

  // 17. download_technical_acknowledgement
  server.registerTool(
    "download_technical_acknowledgement",
    {
      description:
        "Download the content of a technical acknowledgement by its ID.",
      inputSchema: z.object({
        id: z.string().describe("The technical acknowledgement ID"),
      }),
    },
    async ({ id }) => {
      try {
        const content = await context.odataClient.getValue(
          buildTechnicalAckValuePath(id)
        );
        if (!content) {
          return {
            content: [
              { type: "text" as const, text: "No acknowledgement content available." },
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

  // 18. get_functional_acknowledgement
  server.registerTool(
    "get_functional_acknowledgement",
    {
      description:
        "Get a standalone functional acknowledgement by its ID.",
      inputSchema: z.object({
        id: z.string().describe("The functional acknowledgement ID"),
        select: z
          .string()
          .optional()
          .describe("OData $select fields"),
        expand: z
          .string()
          .optional()
          .describe("OData $expand navigation properties"),
      }),
    },
    async ({ id, select, expand }) => {
      try {
        const ack =
          await context.odataClient.getEntity<FunctionalAcknowledgement>(
            buildFunctionalAckPath(id),
            {
              $select: select,
              $expand: expand,
            }
          );
        const text = formatFunctionalAck(ack);
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

  // 19. download_functional_acknowledgement
  server.registerTool(
    "download_functional_acknowledgement",
    {
      description:
        "Download the content of a functional acknowledgement by its ID.",
      inputSchema: z.object({
        id: z.string().describe("The functional acknowledgement ID"),
      }),
    },
    async ({ id }) => {
      try {
        const content = await context.odataClient.getValue(
          buildFunctionalAckValuePath(id)
        );
        if (!content) {
          return {
            content: [
              { type: "text" as const, text: "No acknowledgement content available." },
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

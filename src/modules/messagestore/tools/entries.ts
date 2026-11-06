import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import type { ModuleContext } from "../../../core/types.js";
import { textTool } from "../../../core/tool.js";
import type {
  MessageStoreEntry,
  MessageStoreEntryAttachment,
  MessageStoreEntryProperty,
  MessageStoreEntryAttachmentProperty,
} from "../types.js";
import {
  buildMessageStoreEntriesPath,
  buildMessageStoreEntryPath,
  buildMessageStoreEntryValuePath,
  buildMessageStoreEntryAttachmentsPath,
  buildMessageStoreEntryAttachmentPath,
  buildMessageStoreEntryAttachmentValuePath,
  buildMessageStoreEntryAttachmentPropertiesPath,
  buildMessageStoreEntryAttachmentPropertyPath,
  buildMessageStoreEntryPropertiesPath,
  buildMessageStoreEntryPropertyPath,
} from "../queries.js";

function parseODataDate(value: string | null): string {
  if (!value) return "n/a";
  const match = value.match(/\/Date\((\d+)\)\//);
  if (match) return new Date(parseInt(match[1])).toISOString();
  return value;
}

function formatEntry(e: MessageStoreEntry): string {
  return [
    `Id: ${e.Id ?? "n/a"}`,
    `MessageGuid: ${e.MessageGuid ?? "n/a"}`,
    `MessageStoreId: ${e.MessageStoreId ?? "n/a"}`,
    `TimeStamp: ${parseODataDate(e.TimeStamp)}`,
    `HasAttachments: ${e.HasAttachments}`,
  ].join("\n");
}

function formatAttachment(a: MessageStoreEntryAttachment): string {
  return [
    `Id: ${a.Id ?? "n/a"}`,
    `Name: ${a.Name ?? "n/a"}`,
    `ContentType: ${a.ContentType ?? "n/a"}`,
  ].join("\n");
}

function formatProperty(p: MessageStoreEntryProperty): string {
  return [
    `MessageId: ${p.MessageId ?? "n/a"}`,
    `Name: ${p.Name ?? "n/a"}`,
    `Value: ${p.Value ?? "n/a"}`,
  ].join("\n");
}

function formatAttachmentProperty(
  p: MessageStoreEntryAttachmentProperty
): string {
  return [
    `AttachmentId: ${p.AttachmentId ?? "n/a"}`,
    `Name: ${p.Name ?? "n/a"}`,
    `Value: ${p.Value ?? "n/a"}`,
  ].join("\n");
}

export function registerEntryTools(
  server: McpServer,
  context: ModuleContext
) {
  // @api GET /MessageProcessingLogs('{MessageGuid}')/MessageStoreEntries
  server.registerTool(
    "list_message_store_entries_by_guid",
    {
      description:
        "List message store entries for a specific message processing log by its message GUID.",
      inputSchema: z.object({
        messageGuid: z.string().describe("The message GUID"),
      }),
    },
    textTool(async ({ messageGuid }) => {
      const entries =
        await context.odataClient.getCollection<MessageStoreEntry>(
          buildMessageStoreEntriesPath(messageGuid)
        );
      if (entries.length === 0) {
        return "No message store entries found.";
      }
      const text = entries.map(formatEntry).join("\n\n");
      return text;
    })
  );

  // @api GET /MessageStoreEntries('{MessageStoreEntryId}')
  server.registerTool(
    "get_message_store_entry",
    {
      description: "Get a specific message store entry by its ID.",
      inputSchema: z.object({
        entryId: z.string().describe("The message store entry ID"),
      }),
    },
    textTool(async ({ entryId }) => {
      const entry =
        await context.odataClient.getEntity<MessageStoreEntry>(
          buildMessageStoreEntryPath(entryId)
        );
      const text = formatEntry(entry);
      return text;
    })
  );

  // @api GET /MessageStoreEntries('{MessageStoreEntryId}')/$value
  server.registerTool(
    "download_message_store_entry",
    {
      description:
        "Download the payload of a message store entry by its ID.",
      inputSchema: z.object({
        entryId: z.string().describe("The message store entry ID"),
      }),
    },
    textTool(async ({ entryId }) => {
      const content = await context.odataClient.getValue(
        buildMessageStoreEntryValuePath(entryId)
      );
      if (!content) {
        return "No payload available.";
      }
      return content;
    })
  );

  // @api GET /MessageStoreEntries('{MessageStoreEntryId}')/Attachments
  server.registerTool(
    "list_message_store_entry_attachments",
    {
      description:
        "List all attachments of a message store entry by its ID.",
      inputSchema: z.object({
        entryId: z.string().describe("The message store entry ID"),
      }),
    },
    textTool(async ({ entryId }) => {
      const attachments =
        await context.odataClient.getCollection<MessageStoreEntryAttachment>(
          buildMessageStoreEntryAttachmentsPath(entryId)
        );
      if (attachments.length === 0) {
        return "No attachments found.";
      }
      const text = attachments.map(formatAttachment).join("\n\n");
      return text;
    })
  );

  // @api GET /MessageStoreEntryAttachments('{MessageStoreEntryAttachmentId}')
  server.registerTool(
    "get_message_store_entry_attachment",
    {
      description:
        "Get a specific message store entry attachment by its ID.",
      inputSchema: z.object({
        attachmentId: z.string().describe("The attachment ID"),
      }),
    },
    textTool(async ({ attachmentId }) => {
      const attachment =
        await context.odataClient.getEntity<MessageStoreEntryAttachment>(
          buildMessageStoreEntryAttachmentPath(attachmentId)
        );
      const text = formatAttachment(attachment);
      return text;
    })
  );

  // @api GET /MessageStoreEntryAttachments('{MessageStoreEntryAttachmentId}')/$value
  server.registerTool(
    "download_message_store_entry_attachment",
    {
      description:
        "Download the content of a message store entry attachment by its ID.",
      inputSchema: z.object({
        attachmentId: z.string().describe("The attachment ID"),
      }),
    },
    textTool(async ({ attachmentId }) => {
      const content = await context.odataClient.getValue(
        buildMessageStoreEntryAttachmentValuePath(attachmentId)
      );
      if (!content) {
        return "No attachment content available.";
      }
      return content;
    })
  );

  // @api GET /MessageStoreEntryAttachments('{MessageStoreEntryAttachmentId}')/Properties
  server.registerTool(
    "list_message_store_entry_attachment_properties",
    {
      description:
        "List all properties of a message store entry attachment by its ID.",
      inputSchema: z.object({
        attachmentId: z.string().describe("The attachment ID"),
      }),
    },
    textTool(async ({ attachmentId }) => {
      const properties =
        await context.odataClient.getCollection<MessageStoreEntryAttachmentProperty>(
          buildMessageStoreEntryAttachmentPropertiesPath(attachmentId)
        );
      if (properties.length === 0) {
        return "No attachment properties found.";
      }
      const text = properties.map(formatAttachmentProperty).join("\n\n");
      return text;
    })
  );

  // @api GET /MessageStoreEntryAttachmentProperties(AttachmentId='{MessageStoreEntryAttachmentId}',Name='{Name}')
  server.registerTool(
    "get_message_store_entry_attachment_property",
    {
      description:
        "Get a specific property of a message store entry attachment by attachment ID and property name.",
      inputSchema: z.object({
        attachmentId: z.string().describe("The attachment ID"),
        name: z.string().describe("The property name"),
      }),
    },
    textTool(async ({ attachmentId, name }) => {
      const property =
        await context.odataClient.getEntity<MessageStoreEntryAttachmentProperty>(
          buildMessageStoreEntryAttachmentPropertyPath(attachmentId, name)
        );
      const text = formatAttachmentProperty(property);
      return text;
    })
  );

  // @api GET /MessageStoreEntries('{MessageStoreEntryId}')/Properties
  server.registerTool(
    "list_message_store_entry_properties",
    {
      description:
        "List all properties of a message store entry by its ID.",
      inputSchema: z.object({
        entryId: z.string().describe("The message store entry ID"),
      }),
    },
    textTool(async ({ entryId }) => {
      const properties =
        await context.odataClient.getCollection<MessageStoreEntryProperty>(
          buildMessageStoreEntryPropertiesPath(entryId)
        );
      if (properties.length === 0) {
        return "No entry properties found.";
      }
      const text = properties.map(formatProperty).join("\n\n");
      return text;
    })
  );

  // @api GET /MessageStoreEntryProperties(MessageId='{MessageStoreEntryID}',Name='{PropertyName}')
  server.registerTool(
    "get_message_store_entry_property",
    {
      description:
        "Get a specific property of a message store entry by entry ID and property name.",
      inputSchema: z.object({
        entryId: z.string().describe("The message store entry ID"),
        propertyName: z.string().describe("The property name"),
      }),
    },
    textTool(async ({ entryId, propertyName }) => {
      const property =
        await context.odataClient.getEntity<MessageStoreEntryProperty>(
          buildMessageStoreEntryPropertyPath(entryId, propertyName)
        );
      const text = formatProperty(property);
      return text;
    })
  );
}

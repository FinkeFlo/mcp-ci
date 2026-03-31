import { describe, it, expect, vi, beforeEach } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerEntryTools } from "../tools/entries.js";
import type { ModuleContext } from "../../../core/types.js";

describe("message store entry tools", () => {
  let handlers: Map<string, (...args: any[]) => any>;
  let mockODataClient: {
    getCollection: ReturnType<typeof vi.fn>;
    getEntity: ReturnType<typeof vi.fn>;
    getValue: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
    put: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    handlers = new Map();
    const mockServer = {
      registerTool: (name: string, _opts: any, handler: any) => {
        handlers.set(name, handler);
      },
    } as unknown as McpServer;

    mockODataClient = {
      getCollection: vi.fn(),
      getEntity: vi.fn(),
      getValue: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    };

    const context = {
      tenantManager: {} as any,
      odataClient: mockODataClient as any,
    } satisfies ModuleContext;

    registerEntryTools(mockServer, context);
  });

  it("registers all 10 tools", () => {
    expect(handlers.size).toBe(10);
    expect(handlers.has("list_message_store_entries_by_guid")).toBe(true);
    expect(handlers.has("get_message_store_entry")).toBe(true);
    expect(handlers.has("download_message_store_entry")).toBe(true);
    expect(handlers.has("list_message_store_entry_attachments")).toBe(true);
    expect(handlers.has("get_message_store_entry_attachment")).toBe(true);
    expect(handlers.has("download_message_store_entry_attachment")).toBe(true);
    expect(handlers.has("list_message_store_entry_attachment_properties")).toBe(
      true
    );
    expect(handlers.has("get_message_store_entry_attachment_property")).toBe(
      true
    );
    expect(handlers.has("list_message_store_entry_properties")).toBe(true);
    expect(handlers.has("get_message_store_entry_property")).toBe(true);
  });

  describe("list_message_store_entries_by_guid", () => {
    it("returns formatted entries with parsed dates", async () => {
      mockODataClient.getCollection.mockResolvedValue([
        {
          Id: "entry-1",
          MessageGuid: "guid-1",
          MessageStoreId: "Persist1",
          TimeStamp: "/Date(1522571100123)/",
          HasAttachments: true,
        },
        {
          Id: "entry-2",
          MessageGuid: "guid-2",
          MessageStoreId: "Persist2",
          TimeStamp: null,
          HasAttachments: false,
        },
      ]);

      const result = await handlers.get("list_message_store_entries_by_guid")!({
        messageGuid: "guid-1",
      });
      const text = result.content[0].text;
      expect(text).toContain("Id: entry-1");
      expect(text).toContain("MessageStoreId: Persist1");
      expect(text).toContain("HasAttachments: true");
      expect(text).not.toContain("/Date(");
      expect(text).toContain("Id: entry-2");
      expect(text).toContain("TimeStamp: n/a");
    });

    it("returns empty message when no entries found", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      const result = await handlers.get("list_message_store_entries_by_guid")!({
        messageGuid: "guid-1",
      });
      expect(result.content[0].text).toBe("No message store entries found.");
    });

    it("returns isError on failure", async () => {
      mockODataClient.getCollection.mockRejectedValue(
        new Error("OData error (500): internal server error")
      );
      const result = await handlers.get("list_message_store_entries_by_guid")!({
        messageGuid: "guid-1",
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (500)");
    });
  });

  describe("get_message_store_entry", () => {
    it("returns formatted entry", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        Id: "entry-1",
        MessageGuid: "guid-1",
        MessageStoreId: "Persist1",
        TimeStamp: "/Date(1522571100123)/",
        HasAttachments: true,
      });

      const result = await handlers.get("get_message_store_entry")!({
        entryId: "entry-1",
      });
      const text = result.content[0].text;
      expect(text).toContain("Id: entry-1");
      expect(text).toContain("MessageGuid: guid-1");
      expect(text).not.toContain("/Date(");
    });

    it("returns isError on 404", async () => {
      mockODataClient.getEntity.mockRejectedValue(
        new Error("OData error (404): Resource not found")
      );
      const result = await handlers.get("get_message_store_entry")!({
        entryId: "nonexistent",
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (404)");
    });
  });

  describe("download_message_store_entry", () => {
    it("returns payload content", async () => {
      mockODataClient.getValue.mockResolvedValue("<xml>payload</xml>");
      const result = await handlers.get("download_message_store_entry")!({
        entryId: "entry-1",
      });
      expect(result.content[0].text).toBe("<xml>payload</xml>");
    });

    it("returns no payload message for empty content", async () => {
      mockODataClient.getValue.mockResolvedValue("");
      const result = await handlers.get("download_message_store_entry")!({
        entryId: "entry-1",
      });
      expect(result.content[0].text).toBe("No payload available.");
    });

    it("returns isError on failure", async () => {
      mockODataClient.getValue.mockRejectedValue(
        new Error("OData error (404): Resource not found")
      );
      const result = await handlers.get("download_message_store_entry")!({
        entryId: "entry-1",
      });
      expect(result.isError).toBe(true);
    });
  });

  describe("list_message_store_entry_attachments", () => {
    it("returns formatted attachments", async () => {
      mockODataClient.getCollection.mockResolvedValue([
        {
          Id: "att-1",
          Name: "attachment1.html",
          ContentType: "text/html",
        },
      ]);

      const result = await handlers.get(
        "list_message_store_entry_attachments"
      )!({ entryId: "entry-1" });
      const text = result.content[0].text;
      expect(text).toContain("Id: att-1");
      expect(text).toContain("Name: attachment1.html");
      expect(text).toContain("ContentType: text/html");
    });

    it("returns empty message when no attachments", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      const result = await handlers.get(
        "list_message_store_entry_attachments"
      )!({ entryId: "entry-1" });
      expect(result.content[0].text).toBe("No attachments found.");
    });

    it("returns isError on failure", async () => {
      mockODataClient.getCollection.mockRejectedValue(
        new Error("OData error (500): internal")
      );
      const result = await handlers.get(
        "list_message_store_entry_attachments"
      )!({ entryId: "entry-1" });
      expect(result.isError).toBe(true);
    });
  });

  describe("get_message_store_entry_attachment", () => {
    it("returns formatted attachment", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        Id: "att-1",
        Name: "file.xml",
        ContentType: "application/xml",
      });

      const result = await handlers.get(
        "get_message_store_entry_attachment"
      )!({ attachmentId: "att-1" });
      const text = result.content[0].text;
      expect(text).toContain("Id: att-1");
      expect(text).toContain("Name: file.xml");
    });

    it("returns isError on 404", async () => {
      mockODataClient.getEntity.mockRejectedValue(
        new Error("OData error (404): Not found")
      );
      const result = await handlers.get(
        "get_message_store_entry_attachment"
      )!({ attachmentId: "nonexistent" });
      expect(result.isError).toBe(true);
    });
  });

  describe("download_message_store_entry_attachment", () => {
    it("returns attachment content", async () => {
      mockODataClient.getValue.mockResolvedValue("<html>content</html>");
      const result = await handlers.get(
        "download_message_store_entry_attachment"
      )!({ attachmentId: "att-1" });
      expect(result.content[0].text).toBe("<html>content</html>");
    });

    it("returns no content message for empty attachment", async () => {
      mockODataClient.getValue.mockResolvedValue("");
      const result = await handlers.get(
        "download_message_store_entry_attachment"
      )!({ attachmentId: "att-1" });
      expect(result.content[0].text).toBe("No attachment content available.");
    });

    it("returns isError on failure", async () => {
      mockODataClient.getValue.mockRejectedValue(
        new Error("OData error (500): fail")
      );
      const result = await handlers.get(
        "download_message_store_entry_attachment"
      )!({ attachmentId: "att-1" });
      expect(result.isError).toBe(true);
    });
  });

  describe("list_message_store_entry_attachment_properties", () => {
    it("returns formatted properties", async () => {
      mockODataClient.getCollection.mockResolvedValue([
        {
          AttachmentId: "att-1",
          Name: "Content-Type",
          Value: "text/html",
        },
      ]);

      const result = await handlers.get(
        "list_message_store_entry_attachment_properties"
      )!({ attachmentId: "att-1" });
      const text = result.content[0].text;
      expect(text).toContain("AttachmentId: att-1");
      expect(text).toContain("Name: Content-Type");
      expect(text).toContain("Value: text/html");
    });

    it("returns empty message when no properties", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      const result = await handlers.get(
        "list_message_store_entry_attachment_properties"
      )!({ attachmentId: "att-1" });
      expect(result.content[0].text).toBe("No attachment properties found.");
    });

    it("returns isError on failure", async () => {
      mockODataClient.getCollection.mockRejectedValue(
        new Error("OData error (500): fail")
      );
      const result = await handlers.get(
        "list_message_store_entry_attachment_properties"
      )!({ attachmentId: "att-1" });
      expect(result.isError).toBe(true);
    });
  });

  describe("get_message_store_entry_attachment_property", () => {
    it("returns formatted property", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        AttachmentId: "att-1",
        Name: "Content-Disposition",
        Value: 'attachment; filename="file.html"',
      });

      const result = await handlers.get(
        "get_message_store_entry_attachment_property"
      )!({ attachmentId: "att-1", name: "Content-Disposition" });
      const text = result.content[0].text;
      expect(text).toContain("AttachmentId: att-1");
      expect(text).toContain("Name: Content-Disposition");
      expect(text).toContain("Value: attachment");
    });

    it("returns isError on 404", async () => {
      mockODataClient.getEntity.mockRejectedValue(
        new Error("OData error (404): Not found")
      );
      const result = await handlers.get(
        "get_message_store_entry_attachment_property"
      )!({ attachmentId: "att-1", name: "nonexistent" });
      expect(result.isError).toBe(true);
    });
  });

  describe("list_message_store_entry_properties", () => {
    it("returns formatted properties", async () => {
      mockODataClient.getCollection.mockResolvedValue([
        {
          MessageId: "entry-1",
          Name: "X-receiver",
          Value: "test@example.com",
        },
        {
          MessageId: "entry-1",
          Name: "TestHeader",
          Value: "Header Value",
        },
      ]);

      const result = await handlers.get(
        "list_message_store_entry_properties"
      )!({ entryId: "entry-1" });
      const text = result.content[0].text;
      expect(text).toContain("Name: X-receiver");
      expect(text).toContain("Value: test@example.com");
      expect(text).toContain("Name: TestHeader");
    });

    it("returns empty message when no properties", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      const result = await handlers.get(
        "list_message_store_entry_properties"
      )!({ entryId: "entry-1" });
      expect(result.content[0].text).toBe("No entry properties found.");
    });

    it("returns isError on failure", async () => {
      mockODataClient.getCollection.mockRejectedValue(
        new Error("OData error (500): fail")
      );
      const result = await handlers.get(
        "list_message_store_entry_properties"
      )!({ entryId: "entry-1" });
      expect(result.isError).toBe(true);
    });
  });

  describe("get_message_store_entry_property", () => {
    it("returns formatted property", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        MessageId: "entry-1",
        Name: "X-receiver",
        Value: "test@example.com",
      });

      const result = await handlers.get("get_message_store_entry_property")!({
        entryId: "entry-1",
        propertyName: "X-receiver",
      });
      const text = result.content[0].text;
      expect(text).toContain("MessageId: entry-1");
      expect(text).toContain("Name: X-receiver");
      expect(text).toContain("Value: test@example.com");
    });

    it("returns isError on 404", async () => {
      mockODataClient.getEntity.mockRejectedValue(
        new Error("OData error (404): Not found")
      );
      const result = await handlers.get("get_message_store_entry_property")!({
        entryId: "entry-1",
        propertyName: "nonexistent",
      });
      expect(result.isError).toBe(true);
    });
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/server";
import { idempotentModule } from "../tools.js";
import type { ModuleContext } from "../../../core/types.js";

describe("idempotent tools", () => {
  let handlers: Map<string, (...args: any[]) => any>;
  let mockODataClient: {
    getCollection: ReturnType<typeof vi.fn>;
    getEntity: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };

  const sampleEntry = {
    HexVendor: "534150",
    HexSource: "4d79536f75726365",
    HexEntry: "4d79456e747279",
    HexComponent: "4d79436f6d706f6e656e74",
    Source: "MySource",
    Entry: "MyEntry",
    Component: "MyComponent",
    Vendor: "SAP",
    CreationTime: "2025-01-01T00:00:00Z",
    ExpirationTime: "2026-01-01T00:00:00Z",
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
      delete: vi.fn(),
    };

    const context = {
      tenantManager: {} as any,
      odataClient: mockODataClient as any,
    } satisfies ModuleContext;

    idempotentModule.register(mockServer, context);
  });

  describe("get_idempotent_entries", () => {
    it("lists entries when found", async () => {
      mockODataClient.getCollection.mockResolvedValue([sampleEntry]);
      const result = await handlers.get("get_idempotent_entries")!({
        id: "MyEntry",
      });
      const text = result.content[0].text;
      expect(text).toContain("1 entry/entries found");
      expect(text).toContain("Source: MySource");
      expect(text).toContain("Entry: MyEntry");
      expect(text).toContain("Component: MyComponent");
      expect(text).toContain("Vendor: SAP");
      expect(text).toContain("CreationTime: 2025-01-01T00:00:00Z");
      expect(text).toContain("ExpirationTime: 2026-01-01T00:00:00Z");
    });

    it("returns 'No entries found' when empty", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      const result = await handlers.get("get_idempotent_entries")!({
        id: "unknown",
      });
      expect(result.content[0].text).toBe("No entries found.");
    });

    it("returns isError on OData failure", async () => {
      mockODataClient.getCollection.mockRejectedValue(
        new Error("OData error (500): internal server error")
      );
      const result = await handlers.get("get_idempotent_entries")!({
        id: "MyEntry",
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error");
    });
  });

  describe("get_idempotent_entry", () => {
    it("returns single entry details", async () => {
      mockODataClient.getEntity.mockResolvedValue(sampleEntry);
      const result = await handlers.get("get_idempotent_entry")!({
        vendor: "SAP",
        source: "MySource",
        entry: "MyEntry",
        component: "MyComponent",
      });
      const text = result.content[0].text;
      expect(text).toContain("Idempotent Repository Entry");
      expect(text).toContain("Source: MySource");
      expect(text).toContain("Entry: MyEntry");
      expect(text).toContain("Component: MyComponent");
      expect(text).toContain("Vendor: SAP");
    });

    it("returns isError when entry not found", async () => {
      mockODataClient.getEntity.mockRejectedValue(
        new Error("OData error (404): not found")
      );
      const result = await handlers.get("get_idempotent_entry")!({
        vendor: "SAP",
        source: "x",
        entry: "x",
        component: "x",
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (404)");
    });
  });

  describe("delete_idempotent_entry", () => {
    it("without confirm shows preview and prompt", async () => {
      mockODataClient.getEntity.mockResolvedValue(sampleEntry);
      const result = await handlers.get("delete_idempotent_entry")!({
        vendor: "SAP",
        source: "MySource",
        entry: "MyEntry",
        component: "MyComponent",
      });
      const text = result.content[0].text;
      expect(text).toContain("Entry to be deleted");
      expect(text).toContain("Source: MySource");
      expect(text).toContain("confirm: true");
      expect(mockODataClient.delete).not.toHaveBeenCalled();
    });

    it("with confirm executes delete", async () => {
      mockODataClient.delete.mockResolvedValue(undefined);
      const result = await handlers.get("delete_idempotent_entry")!({
        vendor: "SAP",
        source: "MySource",
        entry: "MyEntry",
        component: "MyComponent",
        confirm: true,
      });
      expect(result.content[0].text).toBe("Entry deleted successfully.");
      expect(mockODataClient.delete).toHaveBeenCalledOnce();
    });

    it("without confirm returns error when preview fetch fails", async () => {
      mockODataClient.getEntity.mockRejectedValue(
        new Error("OData error (404): not found")
      );
      const result = await handlers.get("delete_idempotent_entry")!({
        vendor: "SAP",
        source: "x",
        entry: "x",
        component: "x",
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (404)");
      expect(mockODataClient.delete).not.toHaveBeenCalled();
    });

    it("with confirm returns isError on delete failure", async () => {
      mockODataClient.delete.mockRejectedValue(
        new Error("OData error (403): forbidden")
      );
      const result = await handlers.get("delete_idempotent_entry")!({
        vendor: "SAP",
        source: "MySource",
        entry: "MyEntry",
        component: "MyComponent",
        confirm: true,
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (403)");
    });
  });

  const sampleSimpleEntry = {
    HexSource: "7573657240686f7374",
    HexEntry: "496e707574466f6c6465722f66696c652e786d6c",
    Source: "user@host",
    Entry: "InputFolder/file.xml",
    Component: "SFTP",
    CreationTime: "1541682861073",
    ExpirationTime: "1549458861073",
  };

  describe("list_idempotent_entries", () => {
    it("lists entries when found", async () => {
      mockODataClient.getCollection.mockResolvedValue([sampleSimpleEntry]);
      const result = await handlers.get("list_idempotent_entries")!({
        id: "InputFolder/file.xml",
      });
      const text = result.content[0].text;
      expect(text).toContain("1 entry/entries found");
      expect(text).toContain("Source: user@host");
      expect(text).toContain("Entry: InputFolder/file.xml");
      expect(text).toContain("Component: SFTP");
      expect(text).toContain("CreationTime: 1541682861073");
      expect(text).toContain("ExpirationTime: 1549458861073");
    });

    it("returns 'No entries found' when empty", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      const result = await handlers.get("list_idempotent_entries")!({
        id: "unknown",
      });
      expect(result.content[0].text).toBe("No entries found.");
    });

    it("returns isError on OData failure", async () => {
      mockODataClient.getCollection.mockRejectedValue(
        new Error("OData error (500): internal server error")
      );
      const result = await handlers.get("list_idempotent_entries")!({
        id: "file.xml",
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error");
    });
  });

  describe("get_idempotent_entry_simple", () => {
    it("returns single entry details", async () => {
      mockODataClient.getEntity.mockResolvedValue(sampleSimpleEntry);
      const result = await handlers.get("get_idempotent_entry_simple")!({
        source: "user@host",
        entry: "InputFolder/file.xml",
      });
      const text = result.content[0].text;
      expect(text).toContain("Idempotent Repository Entry");
      expect(text).toContain("Source: user@host");
      expect(text).toContain("Entry: InputFolder/file.xml");
      expect(text).toContain("Component: SFTP");
    });

    it("returns isError when entry not found", async () => {
      mockODataClient.getEntity.mockRejectedValue(
        new Error("OData error (404): not found")
      );
      const result = await handlers.get("get_idempotent_entry_simple")!({
        source: "x",
        entry: "x",
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (404)");
    });
  });

  describe("delete_idempotent_entry_simple", () => {
    it("without confirm shows preview and prompt", async () => {
      mockODataClient.getEntity.mockResolvedValue(sampleSimpleEntry);
      const result = await handlers.get("delete_idempotent_entry_simple")!({
        source: "user@host",
        entry: "InputFolder/file.xml",
      });
      const text = result.content[0].text;
      expect(text).toContain("Entry to be deleted");
      expect(text).toContain("Source: user@host");
      expect(text).toContain("confirm: true");
      expect(mockODataClient.delete).not.toHaveBeenCalled();
    });

    it("with confirm executes delete", async () => {
      mockODataClient.delete.mockResolvedValue(undefined);
      const result = await handlers.get("delete_idempotent_entry_simple")!({
        source: "user@host",
        entry: "InputFolder/file.xml",
        confirm: true,
      });
      expect(result.content[0].text).toBe("Entry deleted successfully.");
      expect(mockODataClient.delete).toHaveBeenCalledOnce();
    });

    it("without confirm returns error when preview fetch fails", async () => {
      mockODataClient.getEntity.mockRejectedValue(
        new Error("OData error (404): not found")
      );
      const result = await handlers.get("delete_idempotent_entry_simple")!({
        source: "x",
        entry: "x",
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (404)");
      expect(mockODataClient.delete).not.toHaveBeenCalled();
    });

    it("with confirm returns isError on delete failure", async () => {
      mockODataClient.delete.mockRejectedValue(
        new Error("OData error (403): forbidden")
      );
      const result = await handlers.get("delete_idempotent_entry_simple")!({
        source: "user@host",
        entry: "InputFolder/file.xml",
        confirm: true,
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (403)");
    });
  });
});

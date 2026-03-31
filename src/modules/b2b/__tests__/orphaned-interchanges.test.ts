import { describe, it, expect, vi, beforeEach } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerOrphanedInterchangeTools } from "../tools/orphaned-interchanges.js";
import type { ModuleContext } from "../../../core/types.js";

describe("orphaned interchange tools", () => {
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

    registerOrphanedInterchangeTools(mockServer, context);
  });

  it("registers all 7 tools", () => {
    expect(handlers.size).toBe(7);
    expect(handlers.has("list_orphaned_interchanges")).toBe(true);
    expect(handlers.has("get_orphaned_interchange")).toBe(true);
    expect(handlers.has("count_orphaned_interchanges")).toBe(true);
    expect(handlers.has("get_orphaned_interchange_errors")).toBe(true);
    expect(handlers.has("get_orphaned_interchange_events")).toBe(true);
    expect(handlers.has("get_orphaned_interchange_payloads")).toBe(true);
    expect(handlers.has("get_orphaned_interchange_headers")).toBe(true);
  });

  describe("list_orphaned_interchanges", () => {
    it("returns formatted interchanges", async () => {
      mockODataClient.getCollection.mockResolvedValue([
        {
          Id: "abc-123",
          AdapterType: "AS2",
          Date: "/Date(1711900800000)/",
        },
        {
          Id: "def-456",
          AdapterType: "IDOC",
          Date: null,
        },
      ]);

      const result = await handlers.get("list_orphaned_interchanges")!({});
      const text = result.content[0].text;
      expect(text).toContain("Id: abc-123");
      expect(text).toContain("AdapterType: AS2");
      expect(text).toContain("Id: def-456");
      expect(text).toContain("AdapterType: IDOC");
      expect(text).toContain("Date: n/a");
    });

    it("parses OData date format", async () => {
      mockODataClient.getCollection.mockResolvedValue([
        {
          Id: "abc-123",
          AdapterType: "AS2",
          Date: "/Date(1711900800000)/",
        },
      ]);

      const result = await handlers.get("list_orphaned_interchanges")!({});
      const text = result.content[0].text;
      expect(text).not.toContain("/Date(");
      expect(text).toContain("2024-");
    });

    it("returns empty message when no interchanges found", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      const result = await handlers.get("list_orphaned_interchanges")!({});
      expect(result.content[0].text).toBe(
        "No orphaned interchanges found."
      );
    });

    it("passes query params to OData client", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      await handlers.get("list_orphaned_interchanges")!({
        filter: "AdapterType eq 'AS2'",
        orderby: "Date desc",
        select: "Id,AdapterType",
        expand: "ErrorDetails",
        top: 10,
        skip: 5,
        inlinecount: "allpages",
      });
      expect(mockODataClient.getCollection).toHaveBeenCalledWith(
        "/api/v1/OrphanedInterchanges",
        {
          $filter: "AdapterType eq 'AS2'",
          $orderby: "Date desc",
          $select: "Id,AdapterType",
          $expand: "ErrorDetails",
          $top: 10,
          $skip: 5,
          $inlinecount: "allpages",
        }
      );
    });

    it("returns isError on failure", async () => {
      mockODataClient.getCollection.mockRejectedValue(
        new Error("OData error (500): internal server error")
      );
      const result = await handlers.get("list_orphaned_interchanges")!({});
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (500)");
    });
  });

  describe("get_orphaned_interchange", () => {
    it("returns formatted interchange with parsed date", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        Id: "abc-123",
        AdapterType: "AS2",
        Date: "/Date(1711900800000)/",
      });

      const result = await handlers.get("get_orphaned_interchange")!({
        id: "abc-123",
      });
      const text = result.content[0].text;
      expect(text).toContain("Id: abc-123");
      expect(text).toContain("AdapterType: AS2");
      expect(text).not.toContain("/Date(");
    });

    it("calls correct path with id", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        Id: "abc-123",
        AdapterType: "AS2",
        Date: null,
      });
      await handlers.get("get_orphaned_interchange")!({ id: "abc-123" });
      expect(mockODataClient.getEntity).toHaveBeenCalledWith(
        "/api/v1/OrphanedInterchanges('abc-123')",
        { $select: undefined, $expand: undefined }
      );
    });

    it("passes select and expand params", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        Id: "abc-123",
        AdapterType: "AS2",
        Date: null,
      });
      await handlers.get("get_orphaned_interchange")!({
        id: "abc-123",
        select: "Id,AdapterType",
        expand: "ErrorDetails",
      });
      expect(mockODataClient.getEntity).toHaveBeenCalledWith(
        "/api/v1/OrphanedInterchanges('abc-123')",
        { $select: "Id,AdapterType", $expand: "ErrorDetails" }
      );
    });

    it("returns isError on 404", async () => {
      mockODataClient.getEntity.mockRejectedValue(
        new Error("OData error (404): Resource not found")
      );
      const result = await handlers.get("get_orphaned_interchange")!({
        id: "nonexistent",
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (404)");
    });
  });

  describe("count_orphaned_interchanges", () => {
    it("returns the count as text", async () => {
      mockODataClient.getValue.mockResolvedValue("15");
      const result = await handlers.get("count_orphaned_interchanges")!({});
      expect(result.content[0].text).toBe("15");
    });

    it("calls count path without filter", async () => {
      mockODataClient.getValue.mockResolvedValue("10");
      await handlers.get("count_orphaned_interchanges")!({});
      expect(mockODataClient.getValue).toHaveBeenCalledWith(
        "/api/v1/OrphanedInterchanges/$count"
      );
    });

    it("appends filter to count path when provided", async () => {
      mockODataClient.getValue.mockResolvedValue("3");
      await handlers.get("count_orphaned_interchanges")!({
        filter: "AdapterType eq 'AS2'",
      });
      expect(mockODataClient.getValue).toHaveBeenCalledWith(
        "/api/v1/OrphanedInterchanges/$count?$filter=AdapterType%20eq%20'AS2'"
      );
    });

    it("returns isError on failure", async () => {
      mockODataClient.getValue.mockRejectedValue(
        new Error("OData error (500): internal server error")
      );
      const result = await handlers.get("count_orphaned_interchanges")!({});
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (500)");
    });
  });

  describe("get_orphaned_interchange_errors", () => {
    it("returns formatted error details", async () => {
      mockODataClient.getCollection.mockResolvedValue([
        {
          Id: "err-001",
          ErrorCategory: "MESSAGE_DECRYPTION",
          ErrorMessage: "Failed to decrypt message",
        },
      ]);

      const result = await handlers.get("get_orphaned_interchange_errors")!({
        id: "abc-123",
      });
      const text = result.content[0].text;
      expect(text).toContain("Id: err-001");
      expect(text).toContain("ErrorCategory: MESSAGE_DECRYPTION");
      expect(text).toContain("ErrorMessage: Failed to decrypt message");
    });

    it("returns empty message when no errors found", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      const result = await handlers.get("get_orphaned_interchange_errors")!({
        id: "abc-123",
      });
      expect(result.content[0].text).toBe(
        "No error details found for this orphaned interchange."
      );
    });

    it("calls correct error details path", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      await handlers.get("get_orphaned_interchange_errors")!({
        id: "abc-123",
      });
      expect(mockODataClient.getCollection).toHaveBeenCalledWith(
        "/api/v1/OrphanedInterchanges('abc-123')/ErrorDetails"
      );
    });

    it("returns isError on failure", async () => {
      mockODataClient.getCollection.mockRejectedValue(
        new Error("OData error (404): Resource not found")
      );
      const result = await handlers.get("get_orphaned_interchange_errors")!({
        id: "nonexistent",
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (404)");
    });
  });

  describe("get_orphaned_interchange_events", () => {
    it("returns formatted events with parsed dates", async () => {
      mockODataClient.getCollection.mockResolvedValue([
        {
          Id: "evt-001",
          EventType: "BUSINESSDOCUMENT_UNASSIGNED_EVENT",
          Date: "/Date(1756695476155)/",
          MonitoringType: "MPL",
          MonitoringId: "SAP_MessageProcessingLogID001",
        },
      ]);

      const result = await handlers.get("get_orphaned_interchange_events")!({
        id: "abc-123",
      });
      const text = result.content[0].text;
      expect(text).toContain("Id: evt-001");
      expect(text).toContain("EventType: BUSINESSDOCUMENT_UNASSIGNED_EVENT");
      expect(text).not.toContain("/Date(");
      expect(text).toContain("MonitoringType: MPL");
      expect(text).toContain("MonitoringId: SAP_MessageProcessingLogID001");
    });

    it("returns empty message when no events found", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      const result = await handlers.get("get_orphaned_interchange_events")!({
        id: "abc-123",
      });
      expect(result.content[0].text).toBe(
        "No processing events found for this orphaned interchange."
      );
    });

    it("passes select and expand params", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      await handlers.get("get_orphaned_interchange_events")!({
        id: "abc-123",
        select: "Id,EventType",
        expand: "BusinessDocument",
      });
      expect(mockODataClient.getCollection).toHaveBeenCalledWith(
        "/api/v1/OrphanedInterchanges('abc-123')/BusinessDocumentProcessingEvent",
        { $select: "Id,EventType", $expand: "BusinessDocument" }
      );
    });

    it("returns isError on failure", async () => {
      mockODataClient.getCollection.mockRejectedValue(
        new Error("OData error (500): internal server error")
      );
      const result = await handlers.get("get_orphaned_interchange_events")!({
        id: "abc-123",
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (500)");
    });
  });

  describe("get_orphaned_interchange_payloads", () => {
    it("returns formatted payloads", async () => {
      mockODataClient.getCollection.mockResolvedValue([
        {
          Id: "pay-001",
          ProcessingState: null,
          Direction: null,
          PayloadId: "pay-001",
          PayloadContainerContentType: "None",
          PayloadContentType: "text/plain",
          ArchivingRelevant: false,
        },
      ]);

      const result = await handlers.get("get_orphaned_interchange_payloads")!({
        id: "abc-123",
      });
      const text = result.content[0].text;
      expect(text).toContain("Id: pay-001");
      expect(text).toContain("PayloadId: pay-001");
      expect(text).toContain("PayloadContentType: text/plain");
      expect(text).toContain("ArchivingRelevant: false");
      expect(text).toContain("ProcessingState: n/a");
      expect(text).toContain("Direction: n/a");
    });

    it("returns empty message when no payloads found", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      const result = await handlers.get("get_orphaned_interchange_payloads")!({
        id: "abc-123",
      });
      expect(result.content[0].text).toBe(
        "No payloads found for this orphaned interchange."
      );
    });

    it("passes select and expand params", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      await handlers.get("get_orphaned_interchange_payloads")!({
        id: "abc-123",
        select: "Id,PayloadId",
        expand: "BusinessDocumentProcessingEvent",
      });
      expect(mockODataClient.getCollection).toHaveBeenCalledWith(
        "/api/v1/OrphanedInterchanges('abc-123')/BusinessDocumentPayloads",
        {
          $select: "Id,PayloadId",
          $expand: "BusinessDocumentProcessingEvent",
        }
      );
    });

    it("returns isError on failure", async () => {
      mockODataClient.getCollection.mockRejectedValue(
        new Error("OData error (404): Resource not found")
      );
      const result = await handlers.get("get_orphaned_interchange_payloads")!({
        id: "nonexistent",
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (404)");
    });
  });

  describe("get_orphaned_interchange_headers", () => {
    it("returns formatted headers", async () => {
      mockODataClient.getCollection.mockResolvedValue([
        {
          Id: "hdr-001",
          Name: "RootName",
          Value: "root_value",
        },
        {
          Id: "hdr-002",
          Name: "RootName2",
          Value: "root_value2",
        },
      ]);

      const result = await handlers.get("get_orphaned_interchange_headers")!({
        id: "abc-123",
      });
      const text = result.content[0].text;
      expect(text).toContain("Id: hdr-001");
      expect(text).toContain("Name: RootName");
      expect(text).toContain("Value: root_value");
      expect(text).toContain("Id: hdr-002");
      expect(text).toContain("Name: RootName2");
      expect(text).toContain("Value: root_value2");
    });

    it("returns empty message when no headers found", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      const result = await handlers.get("get_orphaned_interchange_headers")!({
        id: "abc-123",
      });
      expect(result.content[0].text).toBe(
        "No protocol headers found for this orphaned interchange."
      );
    });

    it("passes select and expand params", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      await handlers.get("get_orphaned_interchange_headers")!({
        id: "abc-123",
        select: "Id,Name,Value",
        expand: "OrphanedInterchange",
      });
      expect(mockODataClient.getCollection).toHaveBeenCalledWith(
        "/api/v1/OrphanedInterchanges('abc-123')/BusinessDocumentProtocolHeaders",
        { $select: "Id,Name,Value", $expand: "OrphanedInterchange" }
      );
    });

    it("returns isError on failure", async () => {
      mockODataClient.getCollection.mockRejectedValue(
        new Error("OData error (500): internal server error")
      );
      const result = await handlers.get("get_orphaned_interchange_headers")!({
        id: "abc-123",
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (500)");
    });
  });
});

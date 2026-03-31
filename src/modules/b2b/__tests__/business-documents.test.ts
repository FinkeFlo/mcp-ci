import { describe, it, expect, vi, beforeEach } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBusinessDocumentTools } from "../tools/business-documents.js";
import type { ModuleContext } from "../../../core/types.js";

describe("business document tools", () => {
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

    registerBusinessDocumentTools(mockServer, context);
  });

  it("registers all 19 tools", () => {
    expect(handlers.size).toBe(19);
    expect(handlers.has("list_business_documents")).toBe(true);
    expect(handlers.has("get_business_document")).toBe(true);
    expect(handlers.has("count_business_documents")).toBe(true);
    expect(handlers.has("get_sender_technical_ack")).toBe(true);
    expect(handlers.has("get_receiver_technical_ack")).toBe(true);
    expect(handlers.has("get_sender_functional_ack")).toBe(true);
    expect(handlers.has("get_receiver_functional_ack")).toBe(true);
    expect(handlers.has("get_business_document_events")).toBe(true);
    expect(handlers.has("get_business_document_payloads")).toBe(true);
    expect(handlers.has("download_business_document_payload")).toBe(true);
    expect(handlers.has("get_business_document_notes")).toBe(true);
    expect(handlers.has("get_business_document_custom_objects")).toBe(true);
    expect(handlers.has("get_business_document_ext_fields")).toBe(true);
    expect(handlers.has("get_business_document_last_error")).toBe(true);
    expect(handlers.has("get_business_document_headers")).toBe(true);
    expect(handlers.has("get_technical_acknowledgement")).toBe(true);
    expect(handlers.has("download_technical_acknowledgement")).toBe(true);
    expect(handlers.has("get_functional_acknowledgement")).toBe(true);
    expect(handlers.has("download_functional_acknowledgement")).toBe(true);
  });

  // --- Core tools ---

  describe("list_business_documents", () => {
    it("returns formatted documents", async () => {
      mockODataClient.getCollection.mockResolvedValue([
        {
          Id: "doc-1",
          SenderTradingPartnerName: "ACME",
          ReceiverTradingPartnerName: "GLOBEX",
          ProcessingStatus: "COMPLETED",
          OverallStatus: "SUCCESS",
          StartedAt: "/Date(1711900800000)/",
          EndedAt: "/Date(1711904400000)/",
          DocumentCreationTime: "/Date(1711897200000)/",
        },
      ]);

      const result = await handlers.get("list_business_documents")!({});
      const text = result.content[0].text;
      expect(text).toContain("Id: doc-1");
      expect(text).toContain("SenderTradingPartnerName: ACME");
      expect(text).toContain("ReceiverTradingPartnerName: GLOBEX");
      expect(text).toContain("ProcessingStatus: COMPLETED");
      expect(text).toContain("OverallStatus: SUCCESS");
      expect(text).not.toContain("/Date(");
    });

    it("returns empty message when no documents found", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      const result = await handlers.get("list_business_documents")!({});
      expect(result.content[0].text).toBe("No business documents found.");
    });

    it("passes all query params to OData client", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      await handlers.get("list_business_documents")!({
        filter: "ProcessingStatus eq 'ERROR'",
        orderby: "StartedAt desc",
        select: "Id,ProcessingStatus",
        expand: "BusinessDocumentPayloads",
        top: 10,
        skip: 5,
        inlinecount: "allpages",
      });
      expect(mockODataClient.getCollection).toHaveBeenCalledWith(
        "/api/v1/BusinessDocuments",
        {
          $filter: "ProcessingStatus eq 'ERROR'",
          $orderby: "StartedAt desc",
          $select: "Id,ProcessingStatus",
          $expand: "BusinessDocumentPayloads",
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
      const result = await handlers.get("list_business_documents")!({});
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (500)");
    });
  });

  describe("get_business_document", () => {
    it("returns formatted document with parsed dates", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        Id: "doc-1",
        SenderTradingPartnerName: "ACME",
        ReceiverTradingPartnerName: "GLOBEX",
        ProcessingStatus: "COMPLETED",
        OverallStatus: "SUCCESS",
        StartedAt: "/Date(1711900800000)/",
        EndedAt: null,
        DocumentCreationTime: "/Date(1711897200000)/",
      });

      const result = await handlers.get("get_business_document")!({
        id: "doc-1",
      });
      const text = result.content[0].text;
      expect(text).toContain("Id: doc-1");
      expect(text).toContain("SenderTradingPartnerName: ACME");
      expect(text).toContain("EndedAt: n/a");
      expect(text).not.toContain("/Date(");
    });

    it("calls correct path", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        Id: "doc-1",
        SenderTradingPartnerName: null,
        ReceiverTradingPartnerName: null,
        ProcessingStatus: null,
        OverallStatus: null,
        StartedAt: null,
        EndedAt: null,
        DocumentCreationTime: null,
      });
      await handlers.get("get_business_document")!({ id: "doc-1" });
      expect(mockODataClient.getEntity).toHaveBeenCalledWith(
        "/api/v1/BusinessDocuments('doc-1')",
        { $select: undefined, $expand: undefined }
      );
    });

    it("returns isError on failure", async () => {
      mockODataClient.getEntity.mockRejectedValue(
        new Error("OData error (404): Resource not found")
      );
      const result = await handlers.get("get_business_document")!({
        id: "nonexistent",
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (404)");
    });
  });

  describe("count_business_documents", () => {
    it("returns the count as text", async () => {
      mockODataClient.getValue.mockResolvedValue("42");
      const result = await handlers.get("count_business_documents")!({});
      expect(result.content[0].text).toBe("42");
    });

    it("calls count path without filter", async () => {
      mockODataClient.getValue.mockResolvedValue("10");
      await handlers.get("count_business_documents")!({});
      expect(mockODataClient.getValue).toHaveBeenCalledWith(
        "/api/v1/BusinessDocuments/$count"
      );
    });

    it("appends filter to count path when provided", async () => {
      mockODataClient.getValue.mockResolvedValue("5");
      await handlers.get("count_business_documents")!({
        filter: "ProcessingStatus eq 'ERROR'",
      });
      expect(mockODataClient.getValue).toHaveBeenCalledWith(
        "/api/v1/BusinessDocuments/$count?$filter=ProcessingStatus%20eq%20'ERROR'"
      );
    });

    it("returns isError on failure", async () => {
      mockODataClient.getValue.mockRejectedValue(
        new Error("OData error (500): internal server error")
      );
      const result = await handlers.get("count_business_documents")!({});
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (500)");
    });
  });

  // --- Acknowledgement navigation tools ---

  describe("get_sender_technical_ack", () => {
    it("returns formatted acknowledgement", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        Id: "ack-1",
        Type: "MDN",
        Direction: "OUTBOUND",
        PayloadId: "payload-1",
        Status: "SENT",
        PayloadContainerContentType: "application/xml",
        PayloadContentType: "application/xml",
      });

      const result = await handlers.get("get_sender_technical_ack")!({
        id: "doc-1",
      });
      const text = result.content[0].text;
      expect(text).toContain("Id: ack-1");
      expect(text).toContain("Type: MDN");
      expect(text).toContain("Direction: OUTBOUND");
      expect(text).toContain("Status: SENT");
    });

    it("calls correct path", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        Id: "ack-1", Type: null, Direction: null, PayloadId: null,
        Status: null, PayloadContainerContentType: null, PayloadContentType: null,
      });
      await handlers.get("get_sender_technical_ack")!({ id: "doc-1" });
      expect(mockODataClient.getEntity).toHaveBeenCalledWith(
        "/api/v1/BusinessDocuments('doc-1')/SenderTechnicalAcknowledgement",
        { $select: undefined, $expand: undefined }
      );
    });

    it("returns isError on failure", async () => {
      mockODataClient.getEntity.mockRejectedValue(
        new Error("OData error (404): Resource not found")
      );
      const result = await handlers.get("get_sender_technical_ack")!({
        id: "doc-1",
      });
      expect(result.isError).toBe(true);
    });
  });

  describe("get_receiver_technical_ack", () => {
    it("returns formatted acknowledgement", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        Id: "ack-2",
        Type: "MDN",
        Direction: "INBOUND",
        PayloadId: "payload-2",
        Status: "RECEIVED",
        PayloadContainerContentType: "application/xml",
        PayloadContentType: "application/xml",
      });

      const result = await handlers.get("get_receiver_technical_ack")!({
        id: "doc-1",
      });
      const text = result.content[0].text;
      expect(text).toContain("Id: ack-2");
      expect(text).toContain("Direction: INBOUND");
    });

    it("calls correct path", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        Id: "ack-2", Type: null, Direction: null, PayloadId: null,
        Status: null, PayloadContainerContentType: null, PayloadContentType: null,
      });
      await handlers.get("get_receiver_technical_ack")!({ id: "doc-1" });
      expect(mockODataClient.getEntity).toHaveBeenCalledWith(
        "/api/v1/BusinessDocuments('doc-1')/ReceiverTechnicalAcknowledgement",
        { $select: undefined, $expand: undefined }
      );
    });

    it("returns isError on failure", async () => {
      mockODataClient.getEntity.mockRejectedValue(new Error("fail"));
      const result = await handlers.get("get_receiver_technical_ack")!({
        id: "x",
      });
      expect(result.isError).toBe(true);
    });
  });

  describe("get_sender_functional_ack", () => {
    it("returns formatted acknowledgement", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        Id: "fack-1",
        Type: "997",
        Direction: "OUTBOUND",
        PayloadId: "pay-1",
        Status: "ACCEPTED",
        PayloadContainerContentType: "application/edi",
        PayloadContentType: "application/edi",
      });

      const result = await handlers.get("get_sender_functional_ack")!({
        id: "doc-1",
      });
      const text = result.content[0].text;
      expect(text).toContain("Id: fack-1");
      expect(text).toContain("Type: 997");
      expect(text).toContain("Status: ACCEPTED");
    });

    it("calls correct path", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        Id: "f-1", Type: null, Direction: null, PayloadId: null,
        Status: null, PayloadContainerContentType: null, PayloadContentType: null,
      });
      await handlers.get("get_sender_functional_ack")!({ id: "doc-1" });
      expect(mockODataClient.getEntity).toHaveBeenCalledWith(
        "/api/v1/BusinessDocuments('doc-1')/SenderFunctionalAcknowledgement",
        { $select: undefined, $expand: undefined }
      );
    });

    it("returns isError on failure", async () => {
      mockODataClient.getEntity.mockRejectedValue(new Error("fail"));
      const result = await handlers.get("get_sender_functional_ack")!({
        id: "x",
      });
      expect(result.isError).toBe(true);
    });
  });

  describe("get_receiver_functional_ack", () => {
    it("returns formatted acknowledgement", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        Id: "fack-2",
        Type: "CONTRL",
        Direction: "INBOUND",
        PayloadId: "pay-2",
        Status: "RECEIVED",
        PayloadContainerContentType: null,
        PayloadContentType: null,
      });

      const result = await handlers.get("get_receiver_functional_ack")!({
        id: "doc-1",
      });
      const text = result.content[0].text;
      expect(text).toContain("Id: fack-2");
      expect(text).toContain("Type: CONTRL");
      expect(text).toContain("PayloadContainerContentType: n/a");
    });

    it("calls correct path", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        Id: "f-2", Type: null, Direction: null, PayloadId: null,
        Status: null, PayloadContainerContentType: null, PayloadContentType: null,
      });
      await handlers.get("get_receiver_functional_ack")!({ id: "doc-1" });
      expect(mockODataClient.getEntity).toHaveBeenCalledWith(
        "/api/v1/BusinessDocuments('doc-1')/ReceiverFunctionalAcknowledgement",
        { $select: undefined, $expand: undefined }
      );
    });

    it("returns isError on failure", async () => {
      mockODataClient.getEntity.mockRejectedValue(new Error("fail"));
      const result = await handlers.get("get_receiver_functional_ack")!({
        id: "x",
      });
      expect(result.isError).toBe(true);
    });
  });

  // --- Collection navigation tools ---

  describe("get_business_document_events", () => {
    it("returns formatted events", async () => {
      mockODataClient.getCollection.mockResolvedValue([
        {
          Id: "evt-1",
          EventType: "SENT",
          Date: "/Date(1711900800000)/",
          MonitoringType: "MPL",
          MonitoringId: "mpl-123",
        },
      ]);

      const result = await handlers.get("get_business_document_events")!({
        id: "doc-1",
      });
      const text = result.content[0].text;
      expect(text).toContain("Id: evt-1");
      expect(text).toContain("EventType: SENT");
      expect(text).not.toContain("/Date(");
      expect(text).toContain("MonitoringId: mpl-123");
    });

    it("returns empty message when no events found", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      const result = await handlers.get("get_business_document_events")!({
        id: "doc-1",
      });
      expect(result.content[0].text).toBe("No processing events found.");
    });

    it("calls correct path", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      await handlers.get("get_business_document_events")!({ id: "doc-1" });
      expect(mockODataClient.getCollection).toHaveBeenCalledWith(
        "/api/v1/BusinessDocuments('doc-1')/BusinessDocumentProcessingEvents",
        { $select: undefined, $expand: undefined }
      );
    });

    it("returns isError on failure", async () => {
      mockODataClient.getCollection.mockRejectedValue(new Error("fail"));
      const result = await handlers.get("get_business_document_events")!({
        id: "x",
      });
      expect(result.isError).toBe(true);
    });
  });

  describe("get_business_document_payloads", () => {
    it("returns formatted payloads", async () => {
      mockODataClient.getCollection.mockResolvedValue([
        {
          Id: "pay-1",
          ProcessingState: "PROCESSED",
          Direction: "INBOUND",
          PayloadId: "pid-1",
          PayloadContainerContentType: "application/xml",
          PayloadContentType: "text/xml",
        },
      ]);

      const result = await handlers.get("get_business_document_payloads")!({
        id: "doc-1",
      });
      const text = result.content[0].text;
      expect(text).toContain("Id: pay-1");
      expect(text).toContain("ProcessingState: PROCESSED");
      expect(text).toContain("Direction: INBOUND");
      expect(text).toContain("PayloadId: pid-1");
    });

    it("returns empty message when no payloads found", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      const result = await handlers.get("get_business_document_payloads")!({
        id: "doc-1",
      });
      expect(result.content[0].text).toBe("No payloads found.");
    });

    it("returns isError on failure", async () => {
      mockODataClient.getCollection.mockRejectedValue(new Error("fail"));
      const result = await handlers.get("get_business_document_payloads")!({
        id: "x",
      });
      expect(result.isError).toBe(true);
    });
  });

  describe("download_business_document_payload", () => {
    it("returns payload content", async () => {
      mockODataClient.getValue.mockResolvedValue("<Invoice>...</Invoice>");
      const result = await handlers.get("download_business_document_payload")!({
        payloadId: "pid-1",
      });
      expect(result.content[0].text).toBe("<Invoice>...</Invoice>");
    });

    it("returns empty message for empty content", async () => {
      mockODataClient.getValue.mockResolvedValue("");
      const result = await handlers.get("download_business_document_payload")!({
        payloadId: "pid-1",
      });
      expect(result.content[0].text).toBe("No payload content available.");
    });

    it("calls correct path", async () => {
      mockODataClient.getValue.mockResolvedValue("content");
      await handlers.get("download_business_document_payload")!({
        payloadId: "pid-1",
      });
      expect(mockODataClient.getValue).toHaveBeenCalledWith(
        "/api/v1/BusinessDocumentPayloads('pid-1')/$value"
      );
    });

    it("returns isError on failure", async () => {
      mockODataClient.getValue.mockRejectedValue(new Error("fail"));
      const result = await handlers.get("download_business_document_payload")!({
        payloadId: "x",
      });
      expect(result.isError).toBe(true);
    });
  });

  describe("get_business_document_notes", () => {
    it("returns formatted notes", async () => {
      mockODataClient.getCollection.mockResolvedValue([
        {
          Id: "note-1",
          User: "admin",
          CreatedAt: "/Date(1711900800000)/",
          NoteContent: "Reprocessed manually",
        },
      ]);

      const result = await handlers.get("get_business_document_notes")!({
        id: "doc-1",
      });
      const text = result.content[0].text;
      expect(text).toContain("Id: note-1");
      expect(text).toContain("User: admin");
      expect(text).toContain("NoteContent: Reprocessed manually");
      expect(text).not.toContain("/Date(");
    });

    it("returns empty message when no notes found", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      const result = await handlers.get("get_business_document_notes")!({
        id: "doc-1",
      });
      expect(result.content[0].text).toBe("No notes found.");
    });

    it("returns isError on failure", async () => {
      mockODataClient.getCollection.mockRejectedValue(new Error("fail"));
      const result = await handlers.get("get_business_document_notes")!({
        id: "x",
      });
      expect(result.isError).toBe(true);
    });
  });

  describe("get_business_document_custom_objects", () => {
    it("returns formatted custom search attributes", async () => {
      mockODataClient.getCollection.mockResolvedValue([
        { Id: "csa-1", Name: "OrderNumber", Value: "PO-12345" },
      ]);

      const result = await handlers.get("get_business_document_custom_objects")!({
        id: "doc-1",
      });
      const text = result.content[0].text;
      expect(text).toContain("Id: csa-1");
      expect(text).toContain("Name: OrderNumber");
      expect(text).toContain("Value: PO-12345");
    });

    it("returns empty message when no custom objects found", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      const result = await handlers.get("get_business_document_custom_objects")!({
        id: "doc-1",
      });
      expect(result.content[0].text).toBe(
        "No custom search attributes found."
      );
    });

    it("returns isError on failure", async () => {
      mockODataClient.getCollection.mockRejectedValue(new Error("fail"));
      const result = await handlers.get("get_business_document_custom_objects")!({
        id: "x",
      });
      expect(result.isError).toBe(true);
    });
  });

  describe("get_business_document_ext_fields", () => {
    it("returns formatted extended fields", async () => {
      mockODataClient.getCollection.mockResolvedValue([
        { Id: "ext-1", Name: "CustomField1", Value: "val1" },
      ]);

      const result = await handlers.get("get_business_document_ext_fields")!({
        id: "doc-1",
      });
      const text = result.content[0].text;
      expect(text).toContain("Id: ext-1");
      expect(text).toContain("Name: CustomField1");
      expect(text).toContain("Value: val1");
    });

    it("returns empty message when no extended fields found", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      const result = await handlers.get("get_business_document_ext_fields")!({
        id: "doc-1",
      });
      expect(result.content[0].text).toBe("No extended fields found.");
    });

    it("returns isError on failure", async () => {
      mockODataClient.getCollection.mockRejectedValue(new Error("fail"));
      const result = await handlers.get("get_business_document_ext_fields")!({
        id: "x",
      });
      expect(result.isError).toBe(true);
    });
  });

  describe("get_business_document_last_error", () => {
    it("returns formatted error details", async () => {
      mockODataClient.getCollection.mockResolvedValue([
        {
          Id: "err-1",
          ErrorCategory: "MAPPING_ERROR",
          ErrorMessage: "Field XYZ is missing",
        },
      ]);

      const result = await handlers.get("get_business_document_last_error")!({
        id: "doc-1",
      });
      const text = result.content[0].text;
      expect(text).toContain("Id: err-1");
      expect(text).toContain("ErrorCategory: MAPPING_ERROR");
      expect(text).toContain("ErrorMessage: Field XYZ is missing");
    });

    it("returns empty message when no errors found", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      const result = await handlers.get("get_business_document_last_error")!({
        id: "doc-1",
      });
      expect(result.content[0].text).toBe("No error details found.");
    });

    it("calls correct path", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      await handlers.get("get_business_document_last_error")!({ id: "doc-1" });
      expect(mockODataClient.getCollection).toHaveBeenCalledWith(
        "/api/v1/BusinessDocuments('doc-1')/LastErrorDetails",
        { $select: undefined, $expand: undefined }
      );
    });

    it("returns isError on failure", async () => {
      mockODataClient.getCollection.mockRejectedValue(new Error("fail"));
      const result = await handlers.get("get_business_document_last_error")!({
        id: "x",
      });
      expect(result.isError).toBe(true);
    });
  });

  describe("get_business_document_headers", () => {
    it("returns formatted headers", async () => {
      mockODataClient.getCollection.mockResolvedValue([
        { Id: "hdr-1", Name: "Content-Type", Value: "application/xml" },
        { Id: "hdr-2", Name: "AS2-From", Value: "ACME-AS2" },
      ]);

      const result = await handlers.get("get_business_document_headers")!({
        id: "doc-1",
      });
      const text = result.content[0].text;
      expect(text).toContain("Id: hdr-1");
      expect(text).toContain("Name: Content-Type");
      expect(text).toContain("Id: hdr-2");
      expect(text).toContain("Name: AS2-From");
    });

    it("returns empty message when no headers found", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      const result = await handlers.get("get_business_document_headers")!({
        id: "doc-1",
      });
      expect(result.content[0].text).toBe("No protocol headers found.");
    });

    it("calls correct path", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      await handlers.get("get_business_document_headers")!({ id: "doc-1" });
      expect(mockODataClient.getCollection).toHaveBeenCalledWith(
        "/api/v1/BusinessDocuments('doc-1')/BusinessDocumentProtocolHeaders",
        { $select: undefined, $expand: undefined }
      );
    });

    it("returns isError on failure", async () => {
      mockODataClient.getCollection.mockRejectedValue(new Error("fail"));
      const result = await handlers.get("get_business_document_headers")!({
        id: "x",
      });
      expect(result.isError).toBe(true);
    });
  });

  // --- Standalone acknowledgement tools ---

  describe("get_technical_acknowledgement", () => {
    it("returns formatted acknowledgement", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        Id: "tack-1",
        Type: "MDN",
        Direction: "OUTBOUND",
        PayloadId: "pay-t1",
        Status: "SENT",
        PayloadContainerContentType: "multipart/report",
        PayloadContentType: "message/disposition-notification",
      });

      const result = await handlers.get("get_technical_acknowledgement")!({
        id: "tack-1",
      });
      const text = result.content[0].text;
      expect(text).toContain("Id: tack-1");
      expect(text).toContain("Type: MDN");
      expect(text).toContain("Status: SENT");
    });

    it("calls correct path", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        Id: "tack-1", Type: null, Direction: null, PayloadId: null,
        Status: null, PayloadContainerContentType: null, PayloadContentType: null,
      });
      await handlers.get("get_technical_acknowledgement")!({ id: "tack-1" });
      expect(mockODataClient.getEntity).toHaveBeenCalledWith(
        "/api/v1/TechnicalAcknowledgements('tack-1')",
        { $select: undefined, $expand: undefined }
      );
    });

    it("returns isError on failure", async () => {
      mockODataClient.getEntity.mockRejectedValue(new Error("fail"));
      const result = await handlers.get("get_technical_acknowledgement")!({
        id: "x",
      });
      expect(result.isError).toBe(true);
    });
  });

  describe("download_technical_acknowledgement", () => {
    it("returns acknowledgement content", async () => {
      mockODataClient.getValue.mockResolvedValue("<MDN>...</MDN>");
      const result = await handlers.get("download_technical_acknowledgement")!({
        id: "tack-1",
      });
      expect(result.content[0].text).toBe("<MDN>...</MDN>");
    });

    it("returns empty message for empty content", async () => {
      mockODataClient.getValue.mockResolvedValue("");
      const result = await handlers.get("download_technical_acknowledgement")!({
        id: "tack-1",
      });
      expect(result.content[0].text).toBe(
        "No acknowledgement content available."
      );
    });

    it("calls correct path", async () => {
      mockODataClient.getValue.mockResolvedValue("content");
      await handlers.get("download_technical_acknowledgement")!({
        id: "tack-1",
      });
      expect(mockODataClient.getValue).toHaveBeenCalledWith(
        "/api/v1/TechnicalAcknowledgements('tack-1')/$value"
      );
    });

    it("returns isError on failure", async () => {
      mockODataClient.getValue.mockRejectedValue(new Error("fail"));
      const result = await handlers.get("download_technical_acknowledgement")!({
        id: "x",
      });
      expect(result.isError).toBe(true);
    });
  });

  describe("get_functional_acknowledgement", () => {
    it("returns formatted acknowledgement", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        Id: "fack-1",
        Type: "997",
        Direction: "INBOUND",
        PayloadId: "pay-f1",
        Status: "ACCEPTED",
        PayloadContainerContentType: "application/edi-x12",
        PayloadContentType: "application/edi-x12",
      });

      const result = await handlers.get("get_functional_acknowledgement")!({
        id: "fack-1",
      });
      const text = result.content[0].text;
      expect(text).toContain("Id: fack-1");
      expect(text).toContain("Type: 997");
      expect(text).toContain("Status: ACCEPTED");
    });

    it("calls correct path", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        Id: "fack-1", Type: null, Direction: null, PayloadId: null,
        Status: null, PayloadContainerContentType: null, PayloadContentType: null,
      });
      await handlers.get("get_functional_acknowledgement")!({ id: "fack-1" });
      expect(mockODataClient.getEntity).toHaveBeenCalledWith(
        "/api/v1/FunctionalAcknowledgements('fack-1')",
        { $select: undefined, $expand: undefined }
      );
    });

    it("returns isError on failure", async () => {
      mockODataClient.getEntity.mockRejectedValue(new Error("fail"));
      const result = await handlers.get("get_functional_acknowledgement")!({
        id: "x",
      });
      expect(result.isError).toBe(true);
    });
  });

  describe("download_functional_acknowledgement", () => {
    it("returns acknowledgement content", async () => {
      mockODataClient.getValue.mockResolvedValue("<CONTRL>...</CONTRL>");
      const result = await handlers.get("download_functional_acknowledgement")!({
        id: "fack-1",
      });
      expect(result.content[0].text).toBe("<CONTRL>...</CONTRL>");
    });

    it("returns empty message for empty content", async () => {
      mockODataClient.getValue.mockResolvedValue("");
      const result = await handlers.get("download_functional_acknowledgement")!({
        id: "fack-1",
      });
      expect(result.content[0].text).toBe(
        "No acknowledgement content available."
      );
    });

    it("calls correct path", async () => {
      mockODataClient.getValue.mockResolvedValue("content");
      await handlers.get("download_functional_acknowledgement")!({
        id: "fack-1",
      });
      expect(mockODataClient.getValue).toHaveBeenCalledWith(
        "/api/v1/FunctionalAcknowledgements('fack-1')/$value"
      );
    });

    it("returns isError on failure", async () => {
      mockODataClient.getValue.mockRejectedValue(new Error("fail"));
      const result = await handlers.get("download_functional_acknowledgement")!({
        id: "x",
      });
      expect(result.isError).toBe(true);
    });
  });
});

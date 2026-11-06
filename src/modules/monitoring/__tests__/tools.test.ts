import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/server";
import { monitoringModule } from "../tools.js";
import type { ModuleContext } from "../../../core/types.js";
import type { MessageProcessingLog, MessageProcessingLogAttachment, MessageStoreEntry, ErrorInformation } from "../types.js";

function makeMpl(overrides: Partial<MessageProcessingLog> = {}): MessageProcessingLog {
  return {
    MessageGuid: "guid-1",
    CorrelationId: null,
    ApplicationMessageId: null,
    IntegrationFlowName: "Flow_A",
    Status: "COMPLETED",
    LogLevel: "INFO",
    Sender: "SenderA",
    Receiver: "ReceiverA",
    LogStart: "2026-03-26T10:00:00Z",
    LogEnd: "2026-03-26T10:01:00Z",
    AlternateWebLink: null,
    IntegrationArtifact: { Id: null, Name: null, Type: null },
    ...overrides,
  };
}

describe("monitoring tools", () => {
  let handlers: Map<string, (...args: any[]) => any>;
  let mockODataClient: {
    getCollection: ReturnType<typeof vi.fn>;
    getEntity: ReturnType<typeof vi.fn>;
    getValue: ReturnType<typeof vi.fn>;
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
    };

    const context = {
      tenantManager: {} as any,
      odataClient: mockODataClient as any,
    } satisfies ModuleContext;

    monitoringModule.register(mockServer, context);
  });

  describe("list_messages", () => {
    it("returns no-messages text when empty", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      const result = await handlers.get("list_messages")!({});
      expect(result.content[0].text).toContain("No messages found");
    });

    it("formats messages with count", async () => {
      mockODataClient.getCollection.mockResolvedValue([
        makeMpl(),
        makeMpl({ MessageGuid: "guid-2" }),
      ]);
      const result = await handlers.get("list_messages")!({});
      expect(result.content[0].text).toContain("Found 2 message(s)");
      expect(result.content[0].text).toContain("guid-1");
    });

    it("returns error on failure", async () => {
      mockODataClient.getCollection.mockRejectedValue(new Error("OData error (500): fail"));
      const result = await handlers.get("list_messages")!({});
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error");
    });
  });

  describe("list_messages CustomStatus", () => {
    it("displays CustomStatus alongside Status (SOAP soft fault)", async () => {
      mockODataClient.getCollection.mockResolvedValue([
        makeMpl({
          MessageGuid: "guid-soft-fault",
          IntegrationFlowName: "Flow_SOAP_Receiver",
          Status: "COMPLETED",
          CustomStatus: "ERROR",
          Receiver: "Legacy_SOAP",
        }),
      ]);
      const result = await handlers.get("list_messages")!({});
      expect(result.content[0].text).toContain("Status: COMPLETED (CustomStatus: ERROR)");
      expect(result.content[0].text).toContain("guid-soft-fault");
    });

    it("does not show CustomStatus when not set", async () => {
      mockODataClient.getCollection.mockResolvedValue([makeMpl()]);
      const result = await handlers.get("list_messages")!({});
      expect(result.content[0].text).toContain("Status: COMPLETED");
      expect(result.content[0].text).not.toContain("CustomStatus");
    });
  });

  describe("list_messages_with_headers", () => {
    it("returns no-messages text when empty", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      const result = await handlers.get("list_messages_with_headers")!({});
      expect(result.content[0].text).toContain("No messages found");
    });

    it("fetches CustomHeaderProperties per message and includes them inline", async () => {
      mockODataClient.getCollection
        .mockResolvedValueOnce([
          makeMpl({ MessageGuid: "guid-1" }),
          makeMpl({ MessageGuid: "guid-2" }),
        ])
        .mockResolvedValueOnce([
          { Id: "h1", Name: "recordCount", Value: "100" },
          { Id: "h2", Name: "topic", Value: "topic-A" },
        ])
        .mockResolvedValueOnce([{ Id: "h3", Name: "recordCount", Value: "250" }]);

      const result = await handlers.get("list_messages_with_headers")!({});
      const text = result.content[0].text;
      expect(text).toContain("Found 2 message(s)");
      expect(text).toContain("recordCount: 100");
      expect(text).toContain("topic: topic-A");
      expect(text).toContain("recordCount: 250");
      expect(mockODataClient.getCollection).toHaveBeenCalledWith(
        "/api/v1/MessageProcessingLogs('guid-1')/CustomHeaderProperties"
      );
      expect(mockODataClient.getCollection).toHaveBeenCalledWith(
        "/api/v1/MessageProcessingLogs('guid-2')/CustomHeaderProperties"
      );
    });

    it("filters headers to whitelist via headerNames", async () => {
      mockODataClient.getCollection
        .mockResolvedValueOnce([makeMpl()])
        .mockResolvedValueOnce([
          { Id: "h1", Name: "recordCount", Value: "100" },
          { Id: "h2", Name: "topic", Value: "topic-A" },
        ]);
      const result = await handlers.get("list_messages_with_headers")!({
        headerNames: ["recordCount"],
      });
      expect(result.content[0].text).toContain("recordCount: 100");
      expect(result.content[0].text).not.toContain("topic");
    });

    it("reports 'none of the requested names set' when whitelist matches nothing", async () => {
      mockODataClient.getCollection
        .mockResolvedValueOnce([makeMpl()])
        .mockResolvedValueOnce([{ Id: "h1", Name: "otherHeader", Value: "x" }]);
      const result = await handlers.get("list_messages_with_headers")!({
        headerNames: ["missing"],
      });
      expect(result.content[0].text).toContain("none of the requested names set");
    });

    it("captures fetch errors per message without failing the batch", async () => {
      mockODataClient.getCollection
        .mockResolvedValueOnce([
          makeMpl({ MessageGuid: "guid-1" }),
          makeMpl({ MessageGuid: "guid-2" }),
        ])
        .mockRejectedValueOnce(new Error("OData error (500): boom"))
        .mockResolvedValueOnce([{ Id: "h1", Name: "ok", Value: "yes" }]);

      const result = await handlers.get("list_messages_with_headers")!({});
      const text = result.content[0].text;
      expect(result.isError).toBeUndefined();
      expect(text).toContain("1 header fetch error(s)");
      expect(text).toContain("ok: yes");
      expect(text).toContain("(error: OData error (500): boom)");
    });

    it("clamps concurrency to 1..50", async () => {
      mockODataClient.getCollection.mockResolvedValueOnce(
        Array.from({ length: 3 }, (_, i) => makeMpl({ MessageGuid: `guid-${i}` }))
      );
      mockODataClient.getCollection.mockResolvedValue([]);
      const result = await handlers.get("list_messages_with_headers")!({ concurrency: 0 });
      expect(result.content[0].text).toContain("Found 3 message(s)");
      expect(mockODataClient.getCollection).toHaveBeenCalledTimes(4);
    });

    it("returns error when the message list fails", async () => {
      mockODataClient.getCollection.mockRejectedValue(new Error("OData error (500): fail"));
      const result = await handlers.get("list_messages_with_headers")!({});
      expect(result.isError).toBe(true);
    });
  });

  describe("aggregate_messages", () => {
    it("returns no-messages text when count is 0", async () => {
      mockODataClient.getValue.mockResolvedValue("0");
      const result = await handlers.get("aggregate_messages")!({});
      expect(result.content[0].text).toContain("No messages");
    });

    it("aggregates by flow name and returns top groups", async () => {
      mockODataClient.getValue.mockResolvedValue("4");
      mockODataClient.getCollection.mockResolvedValueOnce([
        { IntegrationFlowName: "Flow_A" },
        { IntegrationFlowName: "Flow_A" },
        { IntegrationFlowName: "Flow_B" },
        { IntegrationFlowName: "Flow_A" },
      ]);

      const result = await handlers.get("aggregate_messages")!({ status: "FAILED" });
      const text = result.content[0].text;
      expect(text).toContain("Total messages matched: 4");
      expect(text).toContain("Distinct groups: 2");
      expect(text).toMatch(/3\s+Flow_A/);
      expect(text).toMatch(/1\s+Flow_B/);
      expect(mockODataClient.getValue).toHaveBeenCalledWith(
        expect.stringContaining("$count?%24filter=Status%20eq%20'FAILED'")
      );
    });

    it("groups by customStatus", async () => {
      mockODataClient.getValue.mockResolvedValue("2");
      mockODataClient.getCollection.mockResolvedValueOnce([
        { CustomStatus: "ERROR" },
        { CustomStatus: "ERROR" },
      ]);
      const result = await handlers.get("aggregate_messages")!({ groupBy: "customStatus" });
      expect(result.content[0].text).toContain("Aggregation by customStatus (CustomStatus)");
      expect(result.content[0].text).toMatch(/2\s+ERROR/);
    });

    it("paginates across multiple pages until total reached", async () => {
      mockODataClient.getValue.mockResolvedValue("1500");
      mockODataClient.getCollection
        .mockResolvedValueOnce(Array.from({ length: 1000 }, () => ({ IntegrationFlowName: "Flow_X" })))
        .mockResolvedValueOnce(Array.from({ length: 500 }, () => ({ IntegrationFlowName: "Flow_X" })));

      const result = await handlers.get("aggregate_messages")!({});
      expect(mockODataClient.getCollection).toHaveBeenCalledTimes(2);
      expect(result.content[0].text).toContain("Messages scanned: 1500");
      expect(result.content[0].text).toMatch(/1500\s+Flow_X/);
    });

    it("flags truncation when total exceeds maxScan", async () => {
      mockODataClient.getValue.mockResolvedValue("5000");
      mockODataClient.getCollection.mockResolvedValue(
        Array.from({ length: 100 }, () => ({ IntegrationFlowName: "Flow_Y" }))
      );
      const result = await handlers.get("aggregate_messages")!({ maxScan: 100 });
      expect(result.content[0].text).toContain("truncated");
    });

    it("summarises groups beyond top", async () => {
      mockODataClient.getValue.mockResolvedValue("3");
      mockODataClient.getCollection.mockResolvedValueOnce([
        { IntegrationFlowName: "Flow_A" },
        { IntegrationFlowName: "Flow_B" },
        { IntegrationFlowName: "Flow_C" },
      ]);
      const result = await handlers.get("aggregate_messages")!({ top: 1 });
      expect(result.content[0].text).toContain("(2 other groups)");
    });

    it("groups null flow names as (unknown)", async () => {
      mockODataClient.getValue.mockResolvedValue("2");
      mockODataClient.getCollection.mockResolvedValueOnce([
        { IntegrationFlowName: null },
        { IntegrationFlowName: null },
      ]);
      const result = await handlers.get("aggregate_messages")!({});
      expect(result.content[0].text).toMatch(/2\s+\(unknown\)/);
    });
  });

  describe("get_message", () => {
    it("fetches error info for FAILED messages", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        ...makeMpl({ Status: "FAILED" }),
        CustomHeaderProperties: { results: [] },
        AdapterAttributes: { results: [] },
      });
      mockODataClient.getValue.mockResolvedValue("NullPointerException at line 42");

      const result = await handlers.get("get_message")!({ messageGuid: "guid-1" });
      expect(result.content[0].text).toContain("Error Information");
      expect(result.content[0].text).toContain("NullPointerException");
    });

    it("does not fetch error info for COMPLETED messages", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        ...makeMpl({ Status: "COMPLETED" }),
        CustomHeaderProperties: { results: [] },
        AdapterAttributes: { results: [] },
      });

      await handlers.get("get_message")!({ messageGuid: "guid-1" });
      expect(mockODataClient.getValue).not.toHaveBeenCalled();
    });

    it("includes extended fields when present", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        ...makeMpl({ CustomStatus: "CUSTOM_FAIL", TransactionId: "tx-123" }),
        CustomHeaderProperties: { results: [] },
        AdapterAttributes: { results: [] },
      });
      const result = await handlers.get("get_message")!({ messageGuid: "guid-1" });
      expect(result.content[0].text).toContain("CustomStatus: CUSTOM_FAIL");
      expect(result.content[0].text).toContain("TransactionId: tx-123");
    });

    it("includes custom headers and adapter attributes", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        ...makeMpl(),
        CustomHeaderProperties: {
          results: [{ Id: "h1", Name: "X-Custom", Value: "val1" }],
        },
        AdapterAttributes: {
          results: [{ Id: "a1", AdapterId: null, AdapterMessageId: null, Name: "adapter.attr", Value: "val2" }],
        },
      });

      const result = await handlers.get("get_message")!({ messageGuid: "guid-1" });
      expect(result.content[0].text).toContain("X-Custom: val1");
      expect(result.content[0].text).toContain("adapter.attr: val2");
    });
  });

  describe("count_messages", () => {
    it("returns count as number text", async () => {
      mockODataClient.getValue.mockResolvedValue("42");
      const result = await handlers.get("count_messages")!({});
      expect(result.content[0].text).toBe("Message count: 42");
    });

    it("passes filters to the getValue URL with $count and filter params", async () => {
      mockODataClient.getValue.mockResolvedValue("7");
      await handlers.get("count_messages")!({
        status: "FAILED",
        flowName: "MyFlow",
      });
      const calledUrl: string = mockODataClient.getValue.mock.calls[0][0];
      expect(calledUrl).toContain("/$count");
      expect(calledUrl).toContain("%24filter=");
      expect(calledUrl).toContain("FAILED");
      expect(calledUrl).toContain("MyFlow");
    });

    it("returns error on failure", async () => {
      mockODataClient.getValue.mockRejectedValue(new Error("OData error (503): unavailable"));
      const result = await handlers.get("count_messages")!({});
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error");
    });
  });

  describe("get_errors", () => {
    it("returns no-errors text when empty", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      const result = await handlers.get("get_errors")!({});
      expect(result.content[0].text).toContain("No failed messages");
    });

    it("groups failures by flow name", async () => {
      mockODataClient.getCollection.mockResolvedValue([
        makeMpl({ Status: "FAILED", IntegrationFlowName: "Flow_A", MessageGuid: "g1" }),
        makeMpl({ Status: "FAILED", IntegrationFlowName: "Flow_A", MessageGuid: "g2" }),
        makeMpl({ Status: "FAILED", IntegrationFlowName: "Flow_B", MessageGuid: "g3" }),
      ]);
      mockODataClient.getValue.mockResolvedValue("some error");

      const result = await handlers.get("get_errors")!({});
      const text = result.content[0].text;
      expect(text).toContain("Total failed messages: 3");
      expect(text).toContain("Affected flows: 2");
      expect(text).toContain("Flow: Flow_A");
      expect(text).toContain("Failures: 2");
      expect(text).toContain("Flow: Flow_B");
      expect(text).toContain("Failures: 1");
    });

    it("fetches sample error per flow", async () => {
      mockODataClient.getCollection.mockResolvedValue([
        makeMpl({ Status: "FAILED", IntegrationFlowName: "Flow_A", MessageGuid: "g1" }),
        makeMpl({ Status: "FAILED", IntegrationFlowName: "Flow_B", MessageGuid: "g2" }),
      ]);
      mockODataClient.getValue
        .mockResolvedValueOnce("Error from Flow_A")
        .mockResolvedValueOnce("Error from Flow_B");

      const result = await handlers.get("get_errors")!({});
      const text = result.content[0].text;
      expect(text).toContain("Error from Flow_A");
      expect(text).toContain("Error from Flow_B");
      expect(mockODataClient.getValue).toHaveBeenCalledTimes(2);
    });

    it("handles error text fetch failure gracefully", async () => {
      mockODataClient.getCollection.mockResolvedValue([
        makeMpl({ Status: "FAILED", IntegrationFlowName: "Flow_A", MessageGuid: "g1" }),
      ]);
      mockODataClient.getValue.mockRejectedValue(new Error("not found"));

      const result = await handlers.get("get_errors")!({});
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("Flow: Flow_A");
    });
  });

  describe("get_attachments", () => {
    function makeAttachment(
      overrides: Partial<MessageProcessingLogAttachment> = {}
    ): MessageProcessingLogAttachment {
      return {
        Id: "att-1",
        MessageGuid: "guid-1",
        TimeStamp: "2026-03-26T10:00:00Z",
        Name: "payload.xml",
        ContentType: "application/xml",
        PayloadSize: "1024",
        ...overrides,
      };
    }

    it("lists attachments for a message", async () => {
      mockODataClient.getCollection.mockResolvedValue([makeAttachment()]);
      const result = await handlers.get("get_attachments")!({
        messageGuid: "guid-1",
      });
      expect(result.content[0].text).toContain("Found 1 attachment(s)");
      expect(result.content[0].text).toContain("payload.xml");
      expect(result.content[0].text).toContain("1024");
    });

    it("returns no attachments message when empty", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      const result = await handlers.get("get_attachments")!({
        messageGuid: "guid-1",
      });
      expect(result.content[0].text).toContain("No attachments found");
    });

    it("fetches $value content when attachmentId is provided", async () => {
      mockODataClient.getValue.mockResolvedValue("<root>hello</root>");
      const result = await handlers.get("get_attachments")!({
        messageGuid: "guid-1",
        attachmentId: "att-1",
      });
      const calledUrl: string = mockODataClient.getValue.mock.calls[0][0];
      expect(calledUrl).toContain("Attachments('att-1')/$value");
      expect(result.content[0].text).toBe("<root>hello</root>");
    });

    it("truncates $value content larger than 100KB", async () => {
      const bigContent = "x".repeat(100 * 1024 + 50);
      mockODataClient.getValue.mockResolvedValue(bigContent);
      const result = await handlers.get("get_attachments")!({
        messageGuid: "guid-1",
        attachmentId: "att-1",
      });
      expect(result.content[0].text).toContain("[Truncated:");
      expect(result.content[0].text.length).toBeLessThan(bigContent.length);
    });

    it("returns error on failure", async () => {
      mockODataClient.getCollection.mockRejectedValue(
        new Error("OData error (500): server error")
      );
      const result = await handlers.get("get_attachments")!({
        messageGuid: "guid-1",
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error");
    });
  });

  describe("get_message_store_entries", () => {
    function makeEntry(
      overrides: Partial<MessageStoreEntry> = {}
    ): MessageStoreEntry {
      return {
        Id: "mse-1",
        MessageGuid: "guid-1",
        MessageStoreId: "store-abc",
        TimeStamp: "2026-03-26T10:00:00Z",
        HasAttachments: false,
        ...overrides,
      };
    }

    it("lists entries for a message", async () => {
      mockODataClient.getCollection.mockResolvedValue([makeEntry()]);
      const result = await handlers.get("get_message_store_entries")!({
        messageGuid: "guid-1",
      });
      expect(result.content[0].text).toContain("Found 1 message store entry");
      expect(result.content[0].text).toContain("Id: mse-1");
      expect(result.content[0].text).toContain("StoreId: store-abc");
    });

    it("returns no message store entries when empty", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      const result = await handlers.get("get_message_store_entries")!({
        messageGuid: "guid-1",
      });
      expect(result.content[0].text).toContain("No message store entries found");
    });

    it("fetches $value when entryId is provided", async () => {
      mockODataClient.getValue.mockResolvedValue("<entry>data</entry>");
      const result = await handlers.get("get_message_store_entries")!({
        messageGuid: "guid-1",
        entryId: "mse-1",
      });
      const calledUrl: string = mockODataClient.getValue.mock.calls[0][0];
      expect(calledUrl).toContain("MessageStoreEntries('mse-1')/$value");
      expect(result.content[0].text).toBe("<entry>data</entry>");
    });

    it("truncates $value content larger than 100KB", async () => {
      const bigContent = "y".repeat(100 * 1024 + 50);
      mockODataClient.getValue.mockResolvedValue(bigContent);
      const result = await handlers.get("get_message_store_entries")!({
        messageGuid: "guid-1",
        entryId: "mse-1",
      });
      expect(result.content[0].text).toContain("[Truncated:");
      expect(result.content[0].text.length).toBeLessThan(bigContent.length);
    });

    it("returns error on failure", async () => {
      mockODataClient.getCollection.mockRejectedValue(
        new Error("OData error (500): server error")
      );
      const result = await handlers.get("get_message_store_entries")!({
        messageGuid: "guid-1",
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error");
    });
  });

  describe("get_error_info", () => {
    it("returns Type and LastErrorModelStepId for a message", async () => {
      const entity: ErrorInformation = {
        MessageGuid: "guid-1",
        Type: "InconsistencyException",
        LastErrorModelStepId: "CallActivity_42",
      };
      mockODataClient.getEntity.mockResolvedValue(entity);

      const result = await handlers.get("get_error_info")!({
        messageGuid: "guid-1",
      });

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("InconsistencyException");
      expect(result.content[0].text).toContain("CallActivity_42");
    });

    it("returns isError true on failure", async () => {
      mockODataClient.getEntity.mockRejectedValue(
        new Error("OData error (404): not found")
      );

      const result = await handlers.get("get_error_info")!({
        messageGuid: "guid-missing",
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error");
    });
  });
});

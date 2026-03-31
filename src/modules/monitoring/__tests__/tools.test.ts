import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { monitoringModule } from "../tools.js";
import type { ModuleContext } from "../../../core/types.js";
import type { MessageProcessingLog } from "../types.js";

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
});

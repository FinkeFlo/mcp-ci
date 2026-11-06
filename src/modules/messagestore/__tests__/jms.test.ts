import { describe, it, expect, vi, beforeEach } from "vitest";
import type { McpServer } from "@modelcontextprotocol/server";
import { registerJmsTools } from "../tools/jms.js";
import type { ModuleContext } from "../../../core/types.js";

describe("JMS broker tools", () => {
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

    registerJmsTools(mockServer, context);
  });

  it("registers 1 tool", () => {
    expect(handlers.size).toBe(1);
    expect(handlers.has("get_jms_broker")).toBe(true);
  });

  describe("get_jms_broker", () => {
    it("returns formatted broker info with flag interpretation", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        Key: "Broker1",
        Capacity: "794616135",
        MaxCapacity: "9751756800",
        IsTransactedSessionsHigh: 0,
        IsConsumersHigh: 0,
        IsProducersHigh: 1,
        MaxQueueNumber: "30",
        QueueNumber: "16",
        CapacityOk: "16",
        CapacityWarning: "0",
        CapacityError: "0",
      });

      const result = await handlers.get("get_jms_broker")!({});
      const text = result.content[0].text;
      expect(text).toContain("Key: Broker1");
      expect(text).toContain("Capacity: 794616135");
      expect(text).toContain("MaxCapacity: 9751756800");
      expect(text).toContain("IsTransactedSessionsHigh: OK");
      expect(text).toContain("IsConsumersHigh: OK");
      expect(text).toContain("IsProducersHigh: HIGH");
      expect(text).toContain("MaxQueueNumber: 30");
      expect(text).toContain("QueueNumber: 16");
      expect(text).toContain("CapacityOk: 16");
      expect(text).toContain("CapacityWarning: 0");
      expect(text).toContain("CapacityError: 0");
    });

    it("handles null values", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        Key: null,
        Capacity: null,
        MaxCapacity: null,
        IsTransactedSessionsHigh: null,
        IsConsumersHigh: null,
        IsProducersHigh: null,
        MaxQueueNumber: null,
        QueueNumber: null,
        CapacityOk: null,
        CapacityWarning: null,
        CapacityError: null,
      });

      const result = await handlers.get("get_jms_broker")!({});
      const text = result.content[0].text;
      expect(text).toContain("Key: n/a");
      expect(text).toContain("IsTransactedSessionsHigh: n/a");
    });

    it("passes expand parameter when provided", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        Key: "Broker1",
        Capacity: "100",
        MaxCapacity: "1000",
        IsTransactedSessionsHigh: 0,
        IsConsumersHigh: 0,
        IsProducersHigh: 0,
        MaxQueueNumber: "30",
        QueueNumber: "5",
        CapacityOk: "5",
        CapacityWarning: "0",
        CapacityError: "0",
      });

      await handlers.get("get_jms_broker")!({ expand: "QueueStates" });
      expect(mockODataClient.getEntity).toHaveBeenCalledWith(
        "/api/v1/JmsBrokers('Broker1')",
        { $expand: "QueueStates" }
      );
    });

    it("does not pass expand when not provided", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        Key: "Broker1",
        Capacity: "100",
        MaxCapacity: "1000",
        IsTransactedSessionsHigh: 0,
        IsConsumersHigh: 0,
        IsProducersHigh: 0,
        MaxQueueNumber: "30",
        QueueNumber: "5",
        CapacityOk: "5",
        CapacityWarning: "0",
        CapacityError: "0",
      });

      await handlers.get("get_jms_broker")!({});
      expect(mockODataClient.getEntity).toHaveBeenCalledWith(
        "/api/v1/JmsBrokers('Broker1')",
        undefined
      );
    });

    it("returns isError on failure", async () => {
      mockODataClient.getEntity.mockRejectedValue(
        new Error("OData error (500): internal server error")
      );
      const result = await handlers.get("get_jms_broker")!({});
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (500)");
    });
  });
});

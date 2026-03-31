import { describe, it, expect, vi, beforeEach } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTypeArtifactTools } from "../tools/type-artifacts.js";
import type { ModuleContext } from "../../../core/types.js";

describe("type artifact tools", () => {
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

    registerTypeArtifactTools(mockServer, context);
  });

  it("registers all 8 tools", () => {
    expect(handlers.size).toBe(8);
    expect(handlers.has("list_message_types")).toBe(true);
    expect(handlers.has("get_message_type")).toBe(true);
    expect(handlers.has("list_data_types")).toBe(true);
    expect(handlers.has("get_data_type")).toBe(true);
    expect(handlers.has("list_fault_message_types")).toBe(true);
    expect(handlers.has("get_fault_message_type")).toBe(true);
    expect(handlers.has("list_service_interfaces")).toBe(true);
    expect(handlers.has("get_service_interface")).toBe(true);
  });

  describe("list_message_types", () => {
    it("returns formatted message types", async () => {
      mockODataClient.getCollection.mockResolvedValue([
        {
          Id: "mt1",
          Name: "OrderMessage",
          Version: "1.0.0",
          PackageId: "pkg1",
          Namespace: "urn:sap:order",
          Description: "Order message type",
        },
      ]);

      const result = await handlers.get("list_message_types")!({});
      const text = result.content[0].text;
      expect(text).toContain("Id: mt1");
      expect(text).toContain("Name: OrderMessage");
      expect(text).toContain("Version: 1.0.0");
      expect(text).toContain("PackageId: pkg1");
      expect(text).toContain("Namespace: urn:sap:order");
      expect(text).toContain("Description: Order message type");
    });

    it("returns empty message when no types found", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      const result = await handlers.get("list_message_types")!({});
      expect(result.content[0].text).toBe("No message types found.");
    });

    it("truncates long descriptions at 100 chars in list", async () => {
      const longDesc = "A".repeat(150);
      mockODataClient.getCollection.mockResolvedValue([
        {
          Id: "mt1",
          Name: "Test",
          Version: "1.0.0",
          PackageId: "pkg1",
          Namespace: "ns",
          Description: longDesc,
        },
      ]);

      const result = await handlers.get("list_message_types")!({});
      const text = result.content[0].text;
      expect(text).toContain("A".repeat(100) + "...");
      expect(text).not.toContain("A".repeat(150));
    });

    it("calls correct OData path", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      await handlers.get("list_message_types")!({});
      expect(mockODataClient.getCollection).toHaveBeenCalledWith(
        "/api/v1/MessageTypeDesigntimeArtifacts",
        { $filter: undefined, $top: undefined, $skip: undefined }
      );
    });

    it("passes query params", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      await handlers.get("list_message_types")!({
        filter: "PackageId eq 'pkg1'",
        top: 5,
        skip: 10,
      });
      expect(mockODataClient.getCollection).toHaveBeenCalledWith(
        "/api/v1/MessageTypeDesigntimeArtifacts",
        { $filter: "PackageId eq 'pkg1'", $top: 5, $skip: 10 }
      );
    });

    it("returns isError on failure", async () => {
      mockODataClient.getCollection.mockRejectedValue(
        new Error("OData error (500): internal server error")
      );
      const result = await handlers.get("list_message_types")!({});
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (500)");
    });
  });

  describe("get_message_type", () => {
    it("returns formatted detail with full description", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        Id: "mt1",
        Name: "OrderMessage",
        Version: "1.0.0",
        PackageId: "pkg1",
        Namespace: "urn:sap:order",
        Description: "Full description of the order message type",
      });

      const result = await handlers.get("get_message_type")!({ id: "mt1" });
      const text = result.content[0].text;
      expect(text).toContain("Id: mt1");
      expect(text).toContain("Name: OrderMessage");
      expect(text).toContain("Description: Full description of the order message type");
    });

    it("uses default version 'active'", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        Id: "mt1",
        Name: "Test",
        Version: "active",
        PackageId: "pkg1",
        Namespace: "ns",
        Description: null,
      });
      await handlers.get("get_message_type")!({ id: "mt1" });
      expect(mockODataClient.getEntity).toHaveBeenCalledWith(
        "/api/v1/MessageTypeDesigntimeArtifacts(Id='mt1',Version='active')"
      );
    });

    it("uses provided version", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        Id: "mt1",
        Name: "Test",
        Version: "1.0.0",
        PackageId: "pkg1",
        Namespace: "ns",
        Description: null,
      });
      await handlers.get("get_message_type")!({ id: "mt1", version: "1.0.0" });
      expect(mockODataClient.getEntity).toHaveBeenCalledWith(
        "/api/v1/MessageTypeDesigntimeArtifacts(Id='mt1',Version='1.0.0')"
      );
    });

    it("handles null fields gracefully", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        Id: null,
        Name: null,
        Version: null,
        PackageId: null,
        Namespace: null,
        Description: null,
      });
      const result = await handlers.get("get_message_type")!({ id: "mt1" });
      const text = result.content[0].text;
      expect(text).toContain("Id: n/a");
      expect(text).toContain("Name: n/a");
      expect(text).toContain("Namespace: n/a");
      expect(text).toContain("Description: n/a");
    });

    it("returns isError on failure", async () => {
      mockODataClient.getEntity.mockRejectedValue(
        new Error("OData error (404): Resource not found")
      );
      const result = await handlers.get("get_message_type")!({ id: "nonexistent" });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (404)");
    });
  });

  describe("list_data_types", () => {
    it("calls correct entity path", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      await handlers.get("list_data_types")!({});
      expect(mockODataClient.getCollection).toHaveBeenCalledWith(
        "/api/v1/DataTypeDesigntimeArtifacts",
        expect.any(Object)
      );
    });

    it("returns empty message for data types", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      const result = await handlers.get("list_data_types")!({});
      expect(result.content[0].text).toBe("No data types found.");
    });
  });

  describe("get_data_type", () => {
    it("calls correct entity path", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        Id: "dt1",
        Name: "Test",
        Version: "active",
        PackageId: "pkg1",
        Namespace: "ns",
        Description: null,
      });
      await handlers.get("get_data_type")!({ id: "dt1" });
      expect(mockODataClient.getEntity).toHaveBeenCalledWith(
        "/api/v1/DataTypeDesigntimeArtifacts(Id='dt1',Version='active')"
      );
    });
  });

  describe("list_fault_message_types", () => {
    it("calls correct entity path", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      await handlers.get("list_fault_message_types")!({});
      expect(mockODataClient.getCollection).toHaveBeenCalledWith(
        "/api/v1/FaultMessageTypeDesigntimeArtifacts",
        expect.any(Object)
      );
    });

    it("returns empty message for fault message types", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      const result = await handlers.get("list_fault_message_types")!({});
      expect(result.content[0].text).toBe("No fault message types found.");
    });
  });

  describe("get_fault_message_type", () => {
    it("calls correct entity path", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        Id: "fmt1",
        Name: "Test",
        Version: "active",
        PackageId: "pkg1",
        Namespace: "ns",
        Description: null,
      });
      await handlers.get("get_fault_message_type")!({ id: "fmt1" });
      expect(mockODataClient.getEntity).toHaveBeenCalledWith(
        "/api/v1/FaultMessageTypeDesigntimeArtifacts(Id='fmt1',Version='active')"
      );
    });
  });

  describe("list_service_interfaces", () => {
    it("calls correct entity path", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      await handlers.get("list_service_interfaces")!({});
      expect(mockODataClient.getCollection).toHaveBeenCalledWith(
        "/api/v1/ServiceInterfaceDesigntimeArtifacts",
        expect.any(Object)
      );
    });

    it("returns empty message for service interfaces", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      const result = await handlers.get("list_service_interfaces")!({});
      expect(result.content[0].text).toBe("No service interfaces found.");
    });
  });

  describe("get_service_interface", () => {
    it("calls correct entity path", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        Id: "si1",
        Name: "Test",
        Version: "active",
        PackageId: "pkg1",
        Namespace: "ns",
        Description: null,
      });
      await handlers.get("get_service_interface")!({ id: "si1" });
      expect(mockODataClient.getEntity).toHaveBeenCalledWith(
        "/api/v1/ServiceInterfaceDesigntimeArtifacts(Id='si1',Version='active')"
      );
    });
  });
});

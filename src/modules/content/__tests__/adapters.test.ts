import { describe, it, expect, vi, beforeEach } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAdapterTools } from "../tools/adapters.js";
import type { ModuleContext } from "../../../core/types.js";

describe("adapter tools", () => {
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

    registerAdapterTools(mockServer, context);
  });

  it("registers all 3 tools", () => {
    expect(handlers.size).toBe(3);
    expect(handlers.has("deploy_integration_adapter")).toBe(true);
    expect(handlers.has("delete_integration_adapter")).toBe(true);
    expect(handlers.has("get_mdi_delta_token")).toBe(true);
  });

  describe("deploy_integration_adapter", () => {
    it("shows preview without confirm", async () => {
      const result = await handlers.get("deploy_integration_adapter")!({
        id: "adapter1",
        name: "MyAdapter",
      });
      const text = result.content[0].text;
      expect(text).toContain("Adapter to deploy:");
      expect(text).toContain("Id: adapter1");
      expect(text).toContain("Name: MyAdapter");
      expect(text).toContain("Set confirm to true to proceed.");
      expect(mockODataClient.post).not.toHaveBeenCalled();
    });

    it("shows preview without name when not provided", async () => {
      const result = await handlers.get("deploy_integration_adapter")!({
        id: "adapter1",
      });
      const text = result.content[0].text;
      expect(text).toContain("Name: (not specified)");
    });

    it("imports and deploys with confirm", async () => {
      mockODataClient.post.mockResolvedValue({});
      const result = await handlers.get("deploy_integration_adapter")!({
        id: "adapter1",
        name: "MyAdapter",
        confirm: true,
      });
      expect(mockODataClient.post).toHaveBeenCalledTimes(2);
      expect(mockODataClient.post).toHaveBeenCalledWith(
        "/api/v1/IntegrationAdapterDesigntimeArtifacts",
        { Id: "adapter1", Name: "MyAdapter" }
      );
      expect(mockODataClient.post).toHaveBeenCalledWith(
        "/api/v1/DeployIntegrationAdapterDesigntimeArtifact?Id='adapter1'"
      );
      expect(result.content[0].text).toContain("deployed successfully");
    });

    it("imports without name when not provided", async () => {
      mockODataClient.post.mockResolvedValue({});
      await handlers.get("deploy_integration_adapter")!({
        id: "adapter1",
        confirm: true,
      });
      expect(mockODataClient.post).toHaveBeenCalledWith(
        "/api/v1/IntegrationAdapterDesigntimeArtifacts",
        { Id: "adapter1" }
      );
    });

    it("escapes OData special chars in deploy path", async () => {
      mockODataClient.post.mockResolvedValue({});
      await handlers.get("deploy_integration_adapter")!({
        id: "adapter'special",
        confirm: true,
      });
      expect(mockODataClient.post).toHaveBeenCalledWith(
        "/api/v1/DeployIntegrationAdapterDesigntimeArtifact?Id='adapter''special'"
      );
    });

    it("returns isError on failure", async () => {
      mockODataClient.post.mockRejectedValue(
        new Error("OData error (500): internal server error")
      );
      const result = await handlers.get("deploy_integration_adapter")!({
        id: "adapter1",
        confirm: true,
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (500)");
    });
  });

  describe("delete_integration_adapter", () => {
    it("shows preview without confirm", async () => {
      const result = await handlers.get("delete_integration_adapter")!({
        id: "adapter1",
      });
      const text = result.content[0].text;
      expect(text).toContain("Adapter to delete:");
      expect(text).toContain("Id: adapter1");
      expect(text).toContain("Set confirm to true to proceed.");
      expect(mockODataClient.delete).not.toHaveBeenCalled();
    });

    it("deletes with confirm", async () => {
      mockODataClient.delete.mockResolvedValue(undefined);
      const result = await handlers.get("delete_integration_adapter")!({
        id: "adapter1",
        confirm: true,
      });
      expect(mockODataClient.delete).toHaveBeenCalledWith(
        "/api/v1/IntegrationAdapterDesigntimeArtifacts(Id='adapter1')"
      );
      expect(result.content[0].text).toContain("deleted successfully");
    });

    it("returns isError on failure", async () => {
      mockODataClient.delete.mockRejectedValue(
        new Error("OData error (404): Resource not found")
      );
      const result = await handlers.get("delete_integration_adapter")!({
        id: "nonexistent",
        confirm: true,
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (404)");
    });
  });

  describe("get_mdi_delta_token", () => {
    it("returns formatted delta token", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        Operation: "read",
        Entity: "BusinessPartner",
        Version: "v1",
        DeltaToken: "abc123",
        LastUpdateTimestamp: "2024-03-31T10:00:00Z",
      });

      const result = await handlers.get("get_mdi_delta_token")!({
        operation: "read",
        entity: "BusinessPartner",
        version: "v1",
      });
      const text = result.content[0].text;
      expect(text).toContain("Operation: read");
      expect(text).toContain("Entity: BusinessPartner");
      expect(text).toContain("Version: v1");
      expect(text).toContain("DeltaToken: abc123");
      expect(text).toContain("LastUpdateTimestamp: 2024-03-31T10:00:00Z");
    });

    it("handles null DeltaToken and LastUpdateTimestamp", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        Operation: "read",
        Entity: "BusinessPartner",
        Version: "v1",
        DeltaToken: null,
        LastUpdateTimestamp: null,
      });

      const result = await handlers.get("get_mdi_delta_token")!({
        operation: "read",
        entity: "BusinessPartner",
        version: "v1",
      });
      const text = result.content[0].text;
      expect(text).toContain("DeltaToken: n/a");
      expect(text).toContain("LastUpdateTimestamp: n/a");
    });

    it("calls correct OData path", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        Operation: "read",
        Entity: "BusinessPartner",
        Version: "v1",
        DeltaToken: "token",
        LastUpdateTimestamp: null,
      });
      await handlers.get("get_mdi_delta_token")!({
        operation: "read",
        entity: "BusinessPartner",
        version: "v1",
      });
      expect(mockODataClient.getEntity).toHaveBeenCalledWith(
        "/api/v1/MDIDeltaToken(Operation='read',Entity='BusinessPartner',Version='v1')"
      );
    });

    it("returns isError on failure", async () => {
      mockODataClient.getEntity.mockRejectedValue(
        new Error("OData error (404): Resource not found")
      );
      const result = await handlers.get("get_mdi_delta_token")!({
        operation: "read",
        entity: "NonExistent",
        version: "v1",
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (404)");
    });
  });
});

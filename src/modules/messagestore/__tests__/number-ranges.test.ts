import { describe, it, expect, vi, beforeEach } from "vitest";
import type { McpServer } from "@modelcontextprotocol/server";
import { registerNumberRangeTools } from "../tools/number-ranges.js";
import type { ModuleContext } from "../../../core/types.js";

describe("number range tools", () => {
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

    registerNumberRangeTools(mockServer, context);
  });

  it("registers all 5 tools", () => {
    expect(handlers.size).toBe(5);
    expect(handlers.has("list_number_ranges")).toBe(true);
    expect(handlers.has("get_number_range")).toBe(true);
    expect(handlers.has("create_number_range")).toBe(true);
    expect(handlers.has("update_number_range")).toBe(true);
    expect(handlers.has("delete_number_range")).toBe(true);
  });

  describe("list_number_ranges", () => {
    it("returns formatted number ranges", async () => {
      mockODataClient.getCollection.mockResolvedValue([
        {
          Name: "NR1",
          Description: "Test",
          MaxValue: "0000000005",
          MinValue: "0000000001",
          Rotate: "true",
          CurrentValue: "0000000001",
          FieldLength: "10",
          DeployedBy: "User",
          DeployedOn: "2020-07-06T16:08:49.83",
        },
      ]);

      const result = await handlers.get("list_number_ranges")!({});
      const text = result.content[0].text;
      expect(text).toContain("Name: NR1");
      expect(text).toContain("MaxValue: 0000000005");
      expect(text).toContain("Rotate: true");
      expect(text).toContain("DeployedBy: User");
    });

    it("returns empty message when no ranges found", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      const result = await handlers.get("list_number_ranges")!({});
      expect(result.content[0].text).toBe("No number ranges found.");
    });

    it("returns isError on failure", async () => {
      mockODataClient.getCollection.mockRejectedValue(
        new Error("OData error (500): internal")
      );
      const result = await handlers.get("list_number_ranges")!({});
      expect(result.isError).toBe(true);
    });
  });

  describe("get_number_range", () => {
    it("returns formatted number range", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        Name: "NR1",
        Description: "Test",
        MaxValue: "0000000005",
        MinValue: "0000000001",
        Rotate: "true",
        CurrentValue: "0000000003",
        FieldLength: "10",
        DeployedBy: "Admin",
        DeployedOn: "2020-07-06T16:08:49.83",
      });

      const result = await handlers.get("get_number_range")!({ name: "NR1" });
      const text = result.content[0].text;
      expect(text).toContain("Name: NR1");
      expect(text).toContain("CurrentValue: 0000000003");
    });

    it("returns isError on 404", async () => {
      mockODataClient.getEntity.mockRejectedValue(
        new Error("OData error (404): Not found")
      );
      const result = await handlers.get("get_number_range")!({
        name: "nonexistent",
      });
      expect(result.isError).toBe(true);
    });
  });

  describe("create_number_range", () => {
    const createParams = {
      name: "NR1",
      description: "Test",
      maxValue: "0000000005",
      minValue: "0000000001",
      rotate: "true",
      currentValue: "0000000001",
      fieldLength: "10",
    };

    it("shows preview without confirm", async () => {
      const result = await handlers.get("create_number_range")!({
        ...createParams,
      });
      const text = result.content[0].text;
      expect(text).toContain("Number range to create:");
      expect(text).toContain("Name: NR1");
      expect(text).toContain("MaxValue: 0000000005");
      expect(text).toContain("Set confirm to true to proceed.");
      expect(mockODataClient.post).not.toHaveBeenCalled();
    });

    it("creates number range with confirm", async () => {
      mockODataClient.post.mockResolvedValue({});
      const result = await handlers.get("create_number_range")!({
        ...createParams,
        confirm: true,
      });
      expect(mockODataClient.post).toHaveBeenCalledWith(
        "/api/v1/NumberRanges",
        {
          Name: "NR1",
          Description: "Test",
          MaxValue: "0000000005",
          MinValue: "0000000001",
          Rotate: "true",
          CurrentValue: "0000000001",
          FieldLength: "10",
        }
      );
      expect(result.content[0].text).toContain("created successfully");
    });

    it("returns isError on create failure", async () => {
      mockODataClient.post.mockRejectedValue(
        new Error("OData error (400): Bad request")
      );
      const result = await handlers.get("create_number_range")!({
        ...createParams,
        confirm: true,
      });
      expect(result.isError).toBe(true);
    });
  });

  describe("update_number_range", () => {
    const updateParams = {
      name: "NR1",
      description: "Updated",
      maxValue: "0000000010",
      minValue: "0000000001",
      rotate: "false",
      currentValue: "0000000005",
      fieldLength: "10",
    };

    it("shows preview without confirm", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        Name: "NR1",
        Description: "Test",
        MaxValue: "0000000005",
        MinValue: "0000000001",
        Rotate: "true",
        CurrentValue: "0000000001",
        FieldLength: "10",
        DeployedBy: "User",
        DeployedOn: "2020-07-06T16:08:49.83",
      });

      const result = await handlers.get("update_number_range")!({
        ...updateParams,
      });
      const text = result.content[0].text;
      expect(text).toContain("Number range to update:");
      expect(text).toContain("Name: NR1");
      expect(text).toContain("New values:");
      expect(text).toContain("Description: Updated");
      expect(text).toContain("Set confirm to true to proceed.");
      expect(mockODataClient.put).not.toHaveBeenCalled();
    });

    it("updates number range with confirm", async () => {
      mockODataClient.put.mockResolvedValue(undefined);
      const result = await handlers.get("update_number_range")!({
        ...updateParams,
        confirm: true,
      });
      expect(mockODataClient.put).toHaveBeenCalledWith(
        "/api/v1/NumberRanges('NR1')",
        {
          Name: "NR1",
          Description: "Updated",
          MaxValue: "0000000010",
          MinValue: "0000000001",
          Rotate: "false",
          CurrentValue: "0000000005",
          FieldLength: "10",
        }
      );
      expect(result.content[0].text).toContain("updated successfully");
    });

    it("returns isError when preview fetch fails", async () => {
      mockODataClient.getEntity.mockRejectedValue(
        new Error("OData error (404): Not found")
      );
      const result = await handlers.get("update_number_range")!({
        ...updateParams,
      });
      expect(result.isError).toBe(true);
    });

    it("returns isError on update failure", async () => {
      mockODataClient.put.mockRejectedValue(
        new Error("OData error (400): Bad request")
      );
      const result = await handlers.get("update_number_range")!({
        ...updateParams,
        confirm: true,
      });
      expect(result.isError).toBe(true);
    });
  });

  describe("delete_number_range", () => {
    it("shows preview without confirm", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        Name: "NR1",
        Description: "Test",
        MaxValue: "0000000005",
        MinValue: "0000000001",
        Rotate: "true",
        CurrentValue: "0000000001",
        FieldLength: "10",
        DeployedBy: "User",
        DeployedOn: "2020-07-06T16:08:49.83",
      });

      const result = await handlers.get("delete_number_range")!({
        name: "NR1",
      });
      const text = result.content[0].text;
      expect(text).toContain("Number range to delete:");
      expect(text).toContain("Name: NR1");
      expect(text).toContain("Set confirm to true to proceed.");
      expect(mockODataClient.delete).not.toHaveBeenCalled();
    });

    it("deletes number range with confirm", async () => {
      mockODataClient.delete.mockResolvedValue(undefined);
      const result = await handlers.get("delete_number_range")!({
        name: "NR1",
        confirm: true,
      });
      expect(mockODataClient.delete).toHaveBeenCalledWith(
        "/api/v1/NumberRanges('NR1')"
      );
      expect(result.content[0].text).toContain("deleted successfully");
    });

    it("returns isError when preview fetch fails", async () => {
      mockODataClient.getEntity.mockRejectedValue(
        new Error("OData error (404): Not found")
      );
      const result = await handlers.get("delete_number_range")!({
        name: "NR1",
      });
      expect(result.isError).toBe(true);
    });

    it("returns isError when delete fails", async () => {
      mockODataClient.delete.mockRejectedValue(
        new Error("OData error (403): Forbidden")
      );
      const result = await handlers.get("delete_number_range")!({
        name: "NR1",
        confirm: true,
      });
      expect(result.isError).toBe(true);
    });
  });
});

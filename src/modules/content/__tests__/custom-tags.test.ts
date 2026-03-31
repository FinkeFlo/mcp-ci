import { describe, it, expect, vi, beforeEach } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerCustomTagTools } from "../tools/custom-tags.js";
import type { ModuleContext } from "../../../core/types.js";

describe("custom tag tools", () => {
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

    registerCustomTagTools(mockServer, context);
  });

  it("registers all 2 tools", () => {
    expect(handlers.size).toBe(2);
    expect(handlers.has("get_custom_tags_config")).toBe(true);
    expect(handlers.has("update_custom_tags_config")).toBe(true);
  });

  describe("get_custom_tags_config", () => {
    it("returns custom tags config content", async () => {
      const configJson = JSON.stringify([
        { tagName: "Environment", isMandatory: true, permittedValues: ["DEV", "QA", "PROD"] },
        { tagName: "Owner", isMandatory: false },
      ]);
      mockODataClient.getValue.mockResolvedValue(configJson);

      const result = await handlers.get("get_custom_tags_config")!({});
      const text = result.content[0].text;
      expect(text).toContain("Environment");
      expect(text).toContain("Owner");
      expect(text).toContain("DEV");
    });

    it("calls correct $value path", async () => {
      mockODataClient.getValue.mockResolvedValue("{}");
      await handlers.get("get_custom_tags_config")!({});
      expect(mockODataClient.getValue).toHaveBeenCalledWith(
        "/api/v1/CustomTagConfigurations('CustomTags')/$value"
      );
    });

    it("returns isError on failure", async () => {
      mockODataClient.getValue.mockRejectedValue(
        new Error("OData error (500): internal server error")
      );
      const result = await handlers.get("get_custom_tags_config")!({});
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (500)");
    });
  });

  describe("update_custom_tags_config", () => {
    it("shows preview without confirm", async () => {
      const result = await handlers.get("update_custom_tags_config")!({
        content: "base64encodedcontent",
      });
      const text = result.content[0].text;
      expect(text).toContain("Custom tags configuration to update:");
      expect(text).toContain("Content: base64encodedcontent");
      expect(text).toContain("Set confirm to true to proceed.");
      expect(mockODataClient.post).not.toHaveBeenCalled();
    });

    it("updates config with confirm", async () => {
      mockODataClient.post.mockResolvedValue({});
      const result = await handlers.get("update_custom_tags_config")!({
        content: "base64encodedcontent",
        confirm: true,
      });
      expect(mockODataClient.post).toHaveBeenCalledWith(
        "/api/v1/CustomTagConfigurations",
        { customTagsConfiguration: "base64encodedcontent" }
      );
      expect(result.content[0].text).toContain("updated successfully");
    });

    it("returns isError on failure", async () => {
      mockODataClient.post.mockRejectedValue(
        new Error("OData error (400): Bad Request")
      );
      const result = await handlers.get("update_custom_tags_config")!({
        content: "invalid",
        confirm: true,
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (400)");
    });
  });
});

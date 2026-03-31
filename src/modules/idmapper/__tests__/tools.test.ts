import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { idMapperModule } from "../tools.js";
import type { ModuleContext } from "../../../core/types.js";

describe("idmapper tools", () => {
  let handlers: Map<string, (...args: any[]) => any>;
  let mockODataClient: {
    getCollection: ReturnType<typeof vi.fn>;
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
    };

    const context = {
      tenantManager: {} as any,
      odataClient: mockODataClient as any,
    } satisfies ModuleContext;

    idMapperModule.register(mockServer, context);
  });

  describe("get_id_mappings", () => {
    it("returns mappings when searching by sourceId with field normalization", async () => {
      mockODataClient.getCollection.mockResolvedValue([
        {
          ToId: "TGT-001",
          FromId_: "SRC-001",
          Mapper: "MyMapper",
          ExpirationTime: "2026-12-31T00:00:00Z",
          Qualifier: "Q1",
          Context: "ctx-a",
        },
      ]);
      const result = await handlers.get("get_id_mappings")!({ sourceId: "SRC-001" });
      const text = result.content[0].text;
      expect(text).toContain("1 mapping(s) found");
      expect(text).toContain("FromId: SRC-001");
      expect(text).toContain("ToId: TGT-001");
      expect(text).toContain("Mapper: MyMapper");
      expect(text).toContain("Context: ctx-a");
      expect(text).toContain("Qualifier: Q1");
      expect(text).toContain("ExpirationTime: 2026-12-31T00:00:00Z");
    });

    it("returns mappings when searching by targetId with field normalization", async () => {
      mockODataClient.getCollection.mockResolvedValue([
        {
          FromId: "SRC-002",
          ToId2: "TGT-002",
          Mapper: "AnotherMapper",
          ExpirationTime: null,
          Qualifier: null,
          Context: "ctx-b",
        },
      ]);
      const result = await handlers.get("get_id_mappings")!({ targetId: "TGT-002" });
      const text = result.content[0].text;
      expect(text).toContain("1 mapping(s) found");
      expect(text).toContain("FromId: SRC-002");
      expect(text).toContain("ToId: TGT-002");
      expect(text).toContain("Mapper: AnotherMapper");
      expect(text).toContain("Context: ctx-b");
    });

    it("returns 'No mappings found' when empty", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      const result = await handlers.get("get_id_mappings")!({ sourceId: "UNKNOWN" });
      expect(result.content[0].text).toContain("No mappings found");
    });

    it("returns error when both sourceId and targetId are provided", async () => {
      const result = await handlers.get("get_id_mappings")!({
        sourceId: "SRC-001",
        targetId: "TGT-001",
      });
      expect(result.content[0].text).toContain("not both");
      expect(result.isError).toBeUndefined();
    });

    it("returns error when neither sourceId nor targetId is provided", async () => {
      const result = await handlers.get("get_id_mappings")!({});
      expect(result.content[0].text).toContain("required");
      expect(result.isError).toBeUndefined();
    });

    it("returns isError on OData failure", async () => {
      mockODataClient.getCollection.mockRejectedValue(
        new Error("OData error (500): internal server error")
      );
      const result = await handlers.get("get_id_mappings")!({ sourceId: "SRC-001" });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error");
    });
  });
});

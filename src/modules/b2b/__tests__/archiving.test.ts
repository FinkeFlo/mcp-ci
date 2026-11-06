import { describe, it, expect, vi, beforeEach } from "vitest";
import type { McpServer } from "@modelcontextprotocol/server";
import { registerB2BArchivingTools } from "../tools/archiving.js";
import type { ModuleContext } from "../../../core/types.js";

describe("B2B archiving tools", () => {
  let handlers: Map<string, (...args: any[]) => any>;
  let mockODataClient: {
    getValue: ReturnType<typeof vi.fn>;
    getCollection: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    handlers = new Map();
    const mockServer = {
      registerTool: (name: string, _opts: any, handler: any) => {
        handlers.set(name, handler);
      },
    } as unknown as McpServer;

    mockODataClient = {
      getValue: vi.fn(),
      getCollection: vi.fn(),
      post: vi.fn(),
    };

    const context = {
      tenantManager: {} as any,
      odataClient: mockODataClient as any,
    } satisfies ModuleContext;

    registerB2BArchivingTools(mockServer, context);
  });

  describe("get_b2b_archiving_config", () => {
    it("returns ENABLED when IsActivated is true (standard OData format)", async () => {
      mockODataClient.getValue.mockResolvedValue(
        JSON.stringify({ d: { TenantName: "DEV", IsActivated: true } })
      );
      const result = await handlers.get("get_b2b_archiving_config")!({
        tenantName: "DEV",
      });
      expect(result.content[0].text).toBe("B2B archiving is ENABLED");
    });

    it("returns DISABLED when IsActivated is false (standard OData format)", async () => {
      mockODataClient.getValue.mockResolvedValue(
        JSON.stringify({ d: { TenantName: "DEV", IsActivated: false } })
      );
      const result = await handlers.get("get_b2b_archiving_config")!({
        tenantName: "DEV",
      });
      expect(result.content[0].text).toBe("B2B archiving is DISABLED");
    });

    it("returns ENABLED when IsActivated is true (non-standard entry format)", async () => {
      mockODataClient.getValue.mockResolvedValue(
        JSON.stringify({
          entry: {
            content: {
              properties: { TenantName: "DEV", IsActivated: true },
            },
          },
        })
      );
      const result = await handlers.get("get_b2b_archiving_config")!({
        tenantName: "DEV",
      });
      expect(result.content[0].text).toBe("B2B archiving is ENABLED");
    });

    it("returns DISABLED when IsActivated is false (non-standard entry format)", async () => {
      mockODataClient.getValue.mockResolvedValue(
        JSON.stringify({
          entry: {
            content: {
              properties: { TenantName: "DEV", IsActivated: false },
            },
          },
        })
      );
      const result = await handlers.get("get_b2b_archiving_config")!({
        tenantName: "DEV",
      });
      expect(result.content[0].text).toBe("B2B archiving is DISABLED");
    });

    it("uses tenantName param in URL", async () => {
      mockODataClient.getValue.mockResolvedValue(
        JSON.stringify({ d: { IsActivated: false } })
      );
      await handlers.get("get_b2b_archiving_config")!({
        tenantName: "PROD",
      });
      expect(mockODataClient.getValue).toHaveBeenCalledWith(
        "/api/v1/B2BArchivingConfigurations('PROD')"
      );
    });

    it("returns UNKNOWN when IsActivated field is missing", async () => {
      mockODataClient.getValue.mockResolvedValue(
        JSON.stringify({ d: { TenantName: "DEV" } })
      );
      const result = await handlers.get("get_b2b_archiving_config")!({
        tenantName: "DEV",
      });
      expect(result.content[0].text).toBe("B2B archiving status is UNKNOWN");
    });

    it("returns isError on OData failure", async () => {
      mockODataClient.getValue.mockRejectedValue(
        new Error("OData error (500): internal server error")
      );
      const result = await handlers.get("get_b2b_archiving_config")!({
        tenantName: "DEV",
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error");
    });
  });

  describe("get_b2b_archiving_kpis", () => {
    it("lists KPI runs with formatted fields", async () => {
      mockODataClient.getCollection.mockResolvedValue([
        {
          RunStart: "2024-01-15T02:00:00Z",
          RunEnd: "2024-01-15T02:45:00Z",
          RunStatus: "COMPLETED",
          DocumentsArchived: "150",
        },
      ]);
      const result = await handlers.get("get_b2b_archiving_kpis")!({});
      const text = result.content[0].text;
      expect(text).toContain("RunStart: 2024-01-15T02:00:00Z");
      expect(text).toContain("RunEnd: 2024-01-15T02:45:00Z");
      expect(text).toContain("RunStatus: COMPLETED");
      expect(text).toContain("DocumentsArchived: 150");
    });

    it("passes filter to getCollection when provided", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      await handlers.get("get_b2b_archiving_kpis")!({
        filter: "RunStatus eq 'COMPLETED'",
      });
      expect(mockODataClient.getCollection).toHaveBeenCalledWith(
        "/api/v1/B2BArchivingKeyPerformanceIndicators",
        { $filter: "RunStatus eq 'COMPLETED'" }
      );
    });

    it("calls getCollection without params when no filter provided", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      await handlers.get("get_b2b_archiving_kpis")!({});
      expect(mockODataClient.getCollection).toHaveBeenCalledWith(
        "/api/v1/B2BArchivingKeyPerformanceIndicators",
        undefined
      );
    });

    it("returns empty state message when no KPI runs found", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      const result = await handlers.get("get_b2b_archiving_kpis")!({});
      expect(result.content[0].text).toBe("No B2B archiving runs found.");
    });

    it("handles KPIs with null fields gracefully", async () => {
      mockODataClient.getCollection.mockResolvedValue([
        {
          RunStart: "2024-01-15T02:00:00Z",
          RunEnd: null,
          RunStatus: "RUNNING",
          DocumentsArchived: null,
        },
      ]);
      const result = await handlers.get("get_b2b_archiving_kpis")!({});
      const text = result.content[0].text;
      expect(text).toContain("RunStart: 2024-01-15T02:00:00Z");
      expect(text).toContain("RunStatus: RUNNING");
      expect(text).not.toContain("RunEnd");
      expect(text).not.toContain("DocumentsArchived");
    });

    it("returns isError on OData failure", async () => {
      mockODataClient.getCollection.mockRejectedValue(
        new Error("OData error (500): internal server error")
      );
      const result = await handlers.get("get_b2b_archiving_kpis")!({});
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error");
    });
  });

  describe("activate_b2b_archiving", () => {
    it("without confirm shows current config and preview message", async () => {
      mockODataClient.getValue.mockResolvedValue(
        JSON.stringify({ d: { IsActivated: false } })
      );
      const result = await handlers.get("activate_b2b_archiving")!({
        tenantName: "DEV",
      });
      const text = result.content[0].text;
      expect(text).toContain("B2B archiving is DISABLED");
      expect(text).toContain("This will activate B2B archiving");
      expect(text).toContain("confirm: true");
      expect(mockODataClient.post).not.toHaveBeenCalled();
    });

    it("with confirm calls post to activate endpoint with tenant body", async () => {
      mockODataClient.post.mockResolvedValue({
        message: "B2B archiving activation successful.",
      });
      const result = await handlers.get("activate_b2b_archiving")!({
        tenantName: "DEV",
        confirm: true,
      });
      expect(mockODataClient.post).toHaveBeenCalledWith(
        "/api/v1/activateB2BArchivingConfiguration",
        { TenantName: "DEV" }
      );
      expect(result.content[0].text).toContain(
        "B2B archiving activation successful."
      );
    });

    it("with confirm uses fallback message when response has no message field", async () => {
      mockODataClient.post.mockResolvedValue({});
      const result = await handlers.get("activate_b2b_archiving")!({
        tenantName: "DEV",
        confirm: true,
      });
      expect(result.content[0].text).toBe(
        "B2B archiving activated successfully."
      );
    });

    it("returns isError on post failure", async () => {
      mockODataClient.post.mockRejectedValue(
        new Error("OData error (403): forbidden")
      );
      const result = await handlers.get("activate_b2b_archiving")!({
        tenantName: "DEV",
        confirm: true,
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (403)");
    });
  });
});

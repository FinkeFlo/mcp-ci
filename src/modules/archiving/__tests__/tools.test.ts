import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { archivingModule } from "../tools.js";
import type { ModuleContext } from "../../../core/types.js";

describe("archiving tools", () => {
  let handlers: Map<string, (...args: any[]) => any>;
  let mockODataClient: {
    getValue: ReturnType<typeof vi.fn>;
    getCollection: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
  };
  let mockTenantManager: {
    getActiveTenant: ReturnType<typeof vi.fn>;
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

    mockTenantManager = {
      getActiveTenant: vi.fn().mockReturnValue({
        name: "DEV",
        apiUrl: "https://dev.example.com",
        oauthUrl: "https://dev.example.com/oauth/token",
        clientId: "dev-client-id",
        clientSecret: "dev-secret",
      }),
    };

    const context = {
      tenantManager: mockTenantManager as any,
      odataClient: mockODataClient as any,
    } satisfies ModuleContext;

    archivingModule.register(mockServer, context);
  });

  describe("get_archiving_config", () => {
    it("returns ENABLED when IsArchived is true (standard OData format)", async () => {
      mockODataClient.getValue.mockResolvedValue(
        JSON.stringify({ d: { Id: "DEV", IsArchived: true } })
      );
      const result = await handlers.get("get_archiving_config")!({});
      expect(result.content[0].text).toBe("Archiving is ENABLED");
    });

    it("returns DISABLED when IsArchived is false (standard OData format)", async () => {
      mockODataClient.getValue.mockResolvedValue(
        JSON.stringify({ d: { Id: "DEV", IsArchived: false } })
      );
      const result = await handlers.get("get_archiving_config")!({});
      expect(result.content[0].text).toBe("Archiving is DISABLED");
    });

    it("returns ENABLED when IsArchived is true (non-standard entry format)", async () => {
      mockODataClient.getValue.mockResolvedValue(
        JSON.stringify({
          entry: { content: { properties: { Id: "DEV", IsArchived: true } } },
        })
      );
      const result = await handlers.get("get_archiving_config")!({});
      expect(result.content[0].text).toBe("Archiving is ENABLED");
    });

    it("returns DISABLED when IsArchived is false (non-standard entry format)", async () => {
      mockODataClient.getValue.mockResolvedValue(
        JSON.stringify({
          entry: { content: { properties: { Id: "DEV", IsArchived: false } } },
        })
      );
      const result = await handlers.get("get_archiving_config")!({});
      expect(result.content[0].text).toBe("Archiving is DISABLED");
    });

    it("uses tenant name from tenantManager in URL", async () => {
      mockODataClient.getValue.mockResolvedValue(
        JSON.stringify({ d: { IsArchived: false } })
      );
      await handlers.get("get_archiving_config")!({});
      expect(mockODataClient.getValue).toHaveBeenCalledWith(
        "/ArchivingConfigurations('DEV')"
      );
    });

    it("returns UNKNOWN when IsArchived field is missing", async () => {
      mockODataClient.getValue.mockResolvedValue(
        JSON.stringify({ d: { Id: "DEV" } })
      );
      const result = await handlers.get("get_archiving_config")!({});
      expect(result.content[0].text).toBe("Archiving status is UNKNOWN");
    });

    it("returns isError on OData failure", async () => {
      mockODataClient.getValue.mockRejectedValue(
        new Error("OData error (500): internal server error")
      );
      const result = await handlers.get("get_archiving_config")!({});
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error");
    });
  });

  describe("get_archiving_kpis", () => {
    it("lists KPI runs with formatted fields", async () => {
      mockODataClient.getCollection.mockResolvedValue([
        {
          RunStart: "2024-01-15T02:00:00Z",
          RunDurationInMinutes: "45",
          DataCollectionDurationInMinutes: "10",
          DataCompressionDurationInMinutes: "15",
          DataUploadDurationInMinutes: "20",
          MplsToBeArchived: "1000",
          MplsArchived: "998",
          MplsArchivingFailed: "2",
          MplsArchivedUntilDate: "2024-01-14T23:59:59Z",
          DateOfOldestMplToBeArchivedAfterRun: null,
          DataUploadedInMb: "12.5",
          RunStatus: "COMPLETED",
          RunFailedPhase: null,
        },
      ]);
      const result = await handlers.get("get_archiving_kpis")!({});
      const text = result.content[0].text;
      expect(text).toContain("RunStart: 2024-01-15T02:00:00Z");
      expect(text).toContain("RunStatus: COMPLETED");
      expect(text).toContain("Duration: 45 min");
      expect(text).toContain("MplsArchived: 998");
      expect(text).toContain("MplsArchivingFailed: 2");
      expect(text).toContain("DataUploaded: 12.5 MB");
    });

    it("passes filter to getCollection when provided", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      await handlers.get("get_archiving_kpis")!({ filter: "RunStatus eq 'COMPLETED'" });
      expect(mockODataClient.getCollection).toHaveBeenCalledWith(
        "/ArchivingKeyPerformanceIndicators",
        { $filter: "RunStatus eq 'COMPLETED'" }
      );
    });

    it("calls getCollection without params when no filter provided", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      await handlers.get("get_archiving_kpis")!({});
      expect(mockODataClient.getCollection).toHaveBeenCalledWith(
        "/ArchivingKeyPerformanceIndicators",
        undefined
      );
    });

    it("returns empty state message when no KPI runs found", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      const result = await handlers.get("get_archiving_kpis")!({});
      expect(result.content[0].text).toBe("No archiving runs found.");
    });

    it("returns isError on OData failure", async () => {
      mockODataClient.getCollection.mockRejectedValue(
        new Error("OData error (500): internal server error")
      );
      const result = await handlers.get("get_archiving_kpis")!({});
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error");
    });
  });

  describe("activate_archiving", () => {
    it("without confirm shows current config and preview message", async () => {
      mockODataClient.getValue.mockResolvedValue(
        JSON.stringify({ d: { IsArchived: false } })
      );
      const result = await handlers.get("activate_archiving")!({});
      const text = result.content[0].text;
      expect(text).toContain("Archiving is DISABLED");
      expect(text).toContain("This will activate archiving");
      expect(text).toContain("confirm: true");
      expect(mockODataClient.post).not.toHaveBeenCalled();
    });

    it("with confirm calls post to activate endpoint", async () => {
      mockODataClient.post.mockResolvedValue({ message: "Activation successful." });
      const result = await handlers.get("activate_archiving")!({ confirm: true });
      expect(mockODataClient.post).toHaveBeenCalledWith(
        "/api/v1/activateArchivingConfiguration"
      );
      expect(result.content[0].text).toContain("Activation successful.");
    });

    it("with confirm uses fallback message when response has no message field", async () => {
      mockODataClient.post.mockResolvedValue({});
      const result = await handlers.get("activate_archiving")!({ confirm: true });
      expect(result.content[0].text).toBe("Archiving activated successfully.");
    });

    it("returns isError on post failure", async () => {
      mockODataClient.post.mockRejectedValue(
        new Error("OData error (403): forbidden")
      );
      const result = await handlers.get("activate_archiving")!({ confirm: true });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (403)");
    });
  });
});

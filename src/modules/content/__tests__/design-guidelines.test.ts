import { describe, it, expect, vi, beforeEach } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerDesignGuidelineTools } from "../tools/design-guidelines.js";
import type { ModuleContext } from "../../../core/types.js";

describe("design guideline tools", () => {
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

    registerDesignGuidelineTools(mockServer, context);
  });

  it("registers all 5 tools", () => {
    expect(handlers.size).toBe(5);
    expect(handlers.has("list_guideline_results")).toBe(true);
    expect(handlers.has("get_guideline_result")).toBe(true);
    expect(handlers.has("execute_guidelines")).toBe(true);
    expect(handlers.has("download_guideline_result")).toBe(true);
    expect(handlers.has("download_sc_guideline_result")).toBe(true);
  });

  describe("list_guideline_results", () => {
    it("returns formatted guideline results for iflow", async () => {
      mockODataClient.getCollection.mockResolvedValue([
        {
          ExecutionId: "exec1",
          ExecutionStatus: "COMPLETED",
          ExecutionTime: "2026-03-30T10:00:00",
          ArtifactVersion: "1.0.0",
          GuidelineId: "g1",
          GuidelineName: "Check Naming",
          Category: "Naming",
          Severity: "WARNING",
          Applicability: "APPLICABLE",
          Compliance: "COMPLIANT",
        },
      ]);

      const result = await handlers.get("list_guideline_results")!({
        artifactId: "MyIFlow",
        artifactType: "iflow",
      });
      const text = result.content[0].text;
      expect(text).toContain("ExecutionId: exec1");
      expect(text).toContain("ExecutionStatus: COMPLETED");
      expect(text).toContain("GuidelineName: Check Naming");
      expect(text).toContain("Category: Naming");
      expect(text).toContain("Severity: WARNING");
      expect(text).toContain("Compliance: COMPLIANT");
    });

    it("calls correct iflow path with default version", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      await handlers.get("list_guideline_results")!({
        artifactId: "MyIFlow",
        artifactType: "iflow",
      });
      expect(mockODataClient.getCollection).toHaveBeenCalledWith(
        "/api/v1/IntegrationDesigntimeArtifacts(Id='MyIFlow',Version='active')/DesignGuidelineExecutionResults"
      );
    });

    it("calls correct script_collection path", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      await handlers.get("list_guideline_results")!({
        artifactId: "MySC",
        artifactType: "script_collection",
        version: "1.0.0",
      });
      expect(mockODataClient.getCollection).toHaveBeenCalledWith(
        "/api/v1/ScriptCollectionDesigntimeArtifacts(Id='MySC',Version='1.0.0')/DesignGuidelineExecutionResults"
      );
    });

    it("returns empty message when no results found", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      const result = await handlers.get("list_guideline_results")!({
        artifactId: "MyIFlow",
        artifactType: "iflow",
      });
      expect(result.content[0].text).toBe(
        "No guideline execution results found."
      );
    });

    it("returns isError on failure", async () => {
      mockODataClient.getCollection.mockRejectedValue(
        new Error("OData error (500): internal server error")
      );
      const result = await handlers.get("list_guideline_results")!({
        artifactId: "MyIFlow",
        artifactType: "iflow",
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (500)");
    });
  });

  describe("get_guideline_result", () => {
    it("returns formatted guideline result", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        ExecutionId: "exec1",
        ExecutionStatus: "COMPLETED",
        ExecutionTime: "2026-03-30T10:00:00",
        ArtifactVersion: "1.0.0",
        GuidelineId: "g1",
        GuidelineName: "Check Naming",
        Category: "Naming",
        Severity: "WARNING",
        Applicability: "APPLICABLE",
        Compliance: "COMPLIANT",
      });

      const result = await handlers.get("get_guideline_result")!({
        artifactId: "MyIFlow",
        version: "active",
        artifactType: "iflow",
        executionId: "exec1",
      });
      const text = result.content[0].text;
      expect(text).toContain("ExecutionId: exec1");
      expect(text).toContain("ExecutionStatus: COMPLETED");
      expect(text).toContain("ExecutionTime: 2026-03-30T10:00:00");
      expect(text).toContain("GuidelineId: g1");
      expect(text).toContain("GuidelineName: Check Naming");
      expect(text).toContain("Applicability: APPLICABLE");
    });

    it("calls correct iflow path", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        ExecutionId: "exec1",
        ExecutionStatus: "COMPLETED",
        ExecutionTime: null,
        ArtifactVersion: null,
        GuidelineId: null,
        GuidelineName: null,
        Category: null,
        Severity: null,
        Applicability: null,
        Compliance: null,
      });
      await handlers.get("get_guideline_result")!({
        artifactId: "MyIFlow",
        version: "1.0.0",
        artifactType: "iflow",
        executionId: "exec1",
      });
      expect(mockODataClient.getEntity).toHaveBeenCalledWith(
        "/api/v1/IntegrationDesigntimeArtifacts(Id='MyIFlow',Version='1.0.0')/DesignGuidelineExecutionResults('exec1')"
      );
    });

    it("calls correct script_collection path", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        ExecutionId: "exec1",
        ExecutionStatus: "COMPLETED",
        ExecutionTime: null,
        ArtifactVersion: null,
        GuidelineId: null,
        GuidelineName: null,
        Category: null,
        Severity: null,
        Applicability: null,
        Compliance: null,
      });
      await handlers.get("get_guideline_result")!({
        artifactId: "MySC",
        version: "active",
        artifactType: "script_collection",
        executionId: "exec1",
      });
      expect(mockODataClient.getEntity).toHaveBeenCalledWith(
        "/api/v1/ScriptCollectionDesigntimeArtifacts(Id='MySC',Version='active')/DesignGuidelineExecutionResults('exec1')"
      );
    });

    it("handles null fields with n/a", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        ExecutionId: "exec1",
        ExecutionStatus: "PENDING",
        ExecutionTime: null,
        ArtifactVersion: null,
        GuidelineId: null,
        GuidelineName: null,
        Category: null,
        Severity: null,
        Applicability: null,
        Compliance: null,
      });
      const result = await handlers.get("get_guideline_result")!({
        artifactId: "MyIFlow",
        version: "active",
        artifactType: "iflow",
        executionId: "exec1",
      });
      const text = result.content[0].text;
      expect(text).toContain("ExecutionTime: n/a");
      expect(text).toContain("GuidelineId: n/a");
      expect(text).toContain("GuidelineName: n/a");
      expect(text).toContain("Category: n/a");
      expect(text).toContain("Severity: n/a");
      expect(text).toContain("Applicability: n/a");
      expect(text).toContain("Compliance: n/a");
    });

    it("returns isError on 404", async () => {
      mockODataClient.getEntity.mockRejectedValue(
        new Error("OData error (404): Resource not found")
      );
      const result = await handlers.get("get_guideline_result")!({
        artifactId: "nonexistent",
        version: "active",
        artifactType: "iflow",
        executionId: "exec1",
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (404)");
    });
  });

  describe("execute_guidelines", () => {
    it("shows preview without confirm", async () => {
      const result = await handlers.get("execute_guidelines")!({
        artifactId: "MyIFlow",
        version: "1.0.0",
        artifactType: "iflow",
      });
      const text = result.content[0].text;
      expect(text).toContain("Design guidelines to execute:");
      expect(text).toContain("ArtifactId: MyIFlow");
      expect(text).toContain("Version: 1.0.0");
      expect(text).toContain("ArtifactType: iflow");
      expect(text).toContain("Set confirm to true to proceed.");
      expect(mockODataClient.post).not.toHaveBeenCalled();
    });

    it("executes guidelines for iflow with confirm", async () => {
      mockODataClient.post.mockResolvedValue({});
      const result = await handlers.get("execute_guidelines")!({
        artifactId: "MyIFlow",
        version: "1.0.0",
        artifactType: "iflow",
        confirm: true,
      });
      expect(mockODataClient.post).toHaveBeenCalledWith(
        "/api/v1/ExecuteIntegrationDesigntimeArtifactsGuidelines?Id='MyIFlow'&Version='1.0.0'"
      );
      expect(result.content[0].text).toContain(
        "execution triggered successfully"
      );
    });

    it("executes guidelines for script_collection with confirm", async () => {
      mockODataClient.post.mockResolvedValue({});
      await handlers.get("execute_guidelines")!({
        artifactId: "MySC",
        version: "1.0.0",
        artifactType: "script_collection",
        confirm: true,
      });
      expect(mockODataClient.post).toHaveBeenCalledWith(
        "/api/v1/ExecuteScriptCollectionDesigntimeArtifactsGuidelines?Id='MySC'&Version='1.0.0'"
      );
    });

    it("escapes single quotes in artifactId", async () => {
      mockODataClient.post.mockResolvedValue({});
      await handlers.get("execute_guidelines")!({
        artifactId: "Flow's",
        version: "1.0.0",
        artifactType: "iflow",
        confirm: true,
      });
      expect(mockODataClient.post).toHaveBeenCalledWith(
        "/api/v1/ExecuteIntegrationDesigntimeArtifactsGuidelines?Id='Flow''s'&Version='1.0.0'"
      );
    });

    it("returns isError on failure", async () => {
      mockODataClient.post.mockRejectedValue(
        new Error("OData error (500): internal server error")
      );
      const result = await handlers.get("execute_guidelines")!({
        artifactId: "MyIFlow",
        version: "1.0.0",
        artifactType: "iflow",
        confirm: true,
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (500)");
    });
  });

  describe("download_guideline_result", () => {
    it("returns guideline result content", async () => {
      mockODataClient.getValue.mockResolvedValue(
        '{"result": "detailed guideline data"}'
      );
      const result = await handlers.get("download_guideline_result")!({
        artifactId: "MyIFlow",
        version: "active",
        executionId: "exec1",
      });
      const text = result.content[0].text;
      expect(text).toContain("detailed guideline data");
    });

    it("calls correct $value path", async () => {
      mockODataClient.getValue.mockResolvedValue("data");
      await handlers.get("download_guideline_result")!({
        artifactId: "MyIFlow",
        version: "1.0.0",
        executionId: "exec1",
      });
      expect(mockODataClient.getValue).toHaveBeenCalledWith(
        "/api/v1/IntegrationDesigntimeArtifacts(Id='MyIFlow',Version='1.0.0')/DesignGuidelineExecutionResults('exec1')/$value"
      );
    });

    it("truncates large content", async () => {
      const largeContent = "x".repeat(200 * 1024);
      mockODataClient.getValue.mockResolvedValue(largeContent);
      const result = await handlers.get("download_guideline_result")!({
        artifactId: "MyIFlow",
        version: "active",
        executionId: "exec1",
      });
      const text = result.content[0].text;
      expect(text).toContain("TRUNCATED");
      expect(text).toContain("100KB");
    });

    it("returns isError on failure", async () => {
      mockODataClient.getValue.mockRejectedValue(
        new Error("OData error (404): Resource not found")
      );
      const result = await handlers.get("download_guideline_result")!({
        artifactId: "nonexistent",
        version: "active",
        executionId: "exec1",
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (404)");
    });
  });

  describe("download_sc_guideline_result", () => {
    it("returns guideline result content for script collection", async () => {
      mockODataClient.getValue.mockResolvedValue(
        '{"result": "sc guideline data"}'
      );
      const result = await handlers.get("download_sc_guideline_result")!({
        artifactId: "MySC",
        version: "1.0.0",
        executionId: "exec1",
      });
      expect(result.content[0].text).toContain("sc guideline data");
    });

    it("calls correct $value path for script collection", async () => {
      mockODataClient.getValue.mockResolvedValue("data");
      await handlers.get("download_sc_guideline_result")!({
        artifactId: "MySC",
        version: "1.0.0",
        executionId: "exec1",
      });
      expect(mockODataClient.getValue).toHaveBeenCalledWith(
        "/api/v1/ScriptCollectionDesigntimeArtifacts(Id='MySC',Version='1.0.0')/DesignGuidelineExecutionResults('exec1')/$value"
      );
    });

    it("truncates large content", async () => {
      const largeContent = "x".repeat(200 * 1024);
      mockODataClient.getValue.mockResolvedValue(largeContent);
      const result = await handlers.get("download_sc_guideline_result")!({
        artifactId: "MySC",
        version: "active",
        executionId: "exec1",
      });
      const text = result.content[0].text;
      expect(text).toContain("TRUNCATED");
      expect(text).toContain("100KB");
    });

    it("returns isError on failure", async () => {
      mockODataClient.getValue.mockRejectedValue(
        new Error("OData error (404): Resource not found")
      );
      const result = await handlers.get("download_sc_guideline_result")!({
        artifactId: "nonexistent",
        version: "active",
        executionId: "exec1",
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (404)");
    });
  });
});

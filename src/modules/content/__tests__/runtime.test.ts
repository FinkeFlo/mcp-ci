import { describe, it, expect, vi, beforeEach } from "vitest";
import type { McpServer } from "@modelcontextprotocol/server";
import { registerRuntimeTools } from "../tools/runtime.js";
import type { ModuleContext } from "../../../core/types.js";

describe("runtime artifact tools", () => {
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

    registerRuntimeTools(mockServer, context);
  });

  it("registers all 5 tools", () => {
    expect(handlers.size).toBe(5);
    expect(handlers.has("list_runtime_artifacts")).toBe(true);
    expect(handlers.has("get_runtime_artifact")).toBe(true);
    expect(handlers.has("count_runtime_artifacts")).toBe(true);
    expect(handlers.has("get_runtime_artifact_error")).toBe(true);
    expect(handlers.has("undeploy_runtime_artifact")).toBe(true);
  });

  describe("list_runtime_artifacts", () => {
    it("returns formatted artifacts", async () => {
      mockODataClient.getCollection.mockResolvedValue([
        {
          Id: "flow1",
          Name: "My Flow",
          Version: "1.0.0",
          Type: "INTEGRATION_FLOW",
          Status: "STARTED",
          DeployedBy: "admin",
          DeployedOn: "/Date(1711900800000)/",
        },
        {
          Id: "flow2",
          Name: "Other Flow",
          Version: "2.0.0",
          Type: "INTEGRATION_FLOW",
          Status: "ERROR",
          DeployedBy: "dev",
          DeployedOn: null,
        },
      ]);

      const result = await handlers.get("list_runtime_artifacts")!({});
      const text = result.content[0].text;
      expect(text).toContain("Id: flow1");
      expect(text).toContain("Name: My Flow");
      expect(text).toContain("Status: STARTED");
      expect(text).toContain("Id: flow2");
      expect(text).toContain("Status: ERROR");
      expect(text).toContain("DeployedOn: n/a");
    });

    it("prints only the fields the response contains, so a select does not show n/a", async () => {
      mockODataClient.getCollection.mockResolvedValue([{ Id: "flow1", Name: "My Flow", Status: "STARTED" }]);
      const text = (await handlers.get("list_runtime_artifacts")!({ select: "Id,Name,Status" })).content[0].text;
      expect(text).toContain("Status: STARTED");
      expect(text).not.toContain("n/a");
      expect(text).not.toContain("Version");
    });

    it("defaults to 100 results and says how to get the next page", async () => {
      mockODataClient.getCollection.mockResolvedValue(
        Array.from({ length: 100 }, (_, i) => ({ Id: `f${i}`, Name: `F${i}`, Status: "STARTED" }))
      );
      const text = (await handlers.get("list_runtime_artifacts")!({})).content[0].text;
      expect(mockODataClient.getCollection.mock.calls[0][1].$top).toBe(100);
      expect(text).toContain("Showing 100 artifacts starting at 0; more may exist, use skip: 100");
    });

    it("does not add a paging hint below the page size", async () => {
      mockODataClient.getCollection.mockResolvedValue([{ Id: "f1", Status: "STARTED" }]);
      const text = (await handlers.get("list_runtime_artifacts")!({ top: 10, skip: 20 })).content[0].text;
      expect(text).not.toContain("more may exist");
    });

    it("summary counts artifacts by status and type without listing them", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      mockODataClient.getCollection.mockResolvedValueOnce([
        { Status: "STARTED", Type: "INTEGRATION_FLOW" },
        { Status: "STARTED", Type: "INTEGRATION_FLOW" },
        { Status: "ERROR", Type: "INTEGRATION_FLOW" },
        { Status: "STARTED", Type: "VALUE_MAPPING" },
      ]);
      const text = (await handlers.get("list_runtime_artifacts")!({ summary: true, filter: "Type eq 'INTEGRATION_FLOW'" })).content[0].text;
      const [, params] = mockODataClient.getCollection.mock.calls[0];
      expect(params).toEqual({ $filter: "Type eq 'INTEGRATION_FLOW'", $select: "Status,Type", $top: 1000, $skip: 0 });
      expect(text).toContain("4 artifact(s)");
      expect(text).toContain("STARTED: 3");
      expect(text).toContain("ERROR: 1");
      expect(text).toContain("INTEGRATION_FLOW: 3");
      expect(text).toContain("VALUE_MAPPING: 1");
    });

    it("summary pages through every server page, even if the server caps the page size", async () => {
      const rows = (n: number, status: string) => Array.from({ length: n }, () => ({ Status: status, Type: "INTEGRATION_FLOW" }));
      // The server returns at most 3 rows per request, whatever $top asks for.
      mockODataClient.getCollection
        .mockResolvedValueOnce(rows(3, "STARTED"))
        .mockResolvedValueOnce(rows(3, "STARTED"))
        .mockResolvedValueOnce(rows(1, "ERROR"));
      const text = (await handlers.get("list_runtime_artifacts")!({ summary: true })).content[0].text;
      expect(text).toContain("7 artifact(s)");
      expect(text).toContain("ERROR: 1");
      expect(mockODataClient.getCollection.mock.calls.map(([, p]) => p.$skip)).toEqual([0, 3, 6]);
    });

    it("returns empty message when no artifacts found", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      const result = await handlers.get("list_runtime_artifacts")!({});
      expect(result.content[0].text).toBe("No deployed artifacts found.");
    });

    it("passes query params to OData client", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      await handlers.get("list_runtime_artifacts")!({
        filter: "Status eq 'ERROR'",
        select: "Id,Name",
        orderby: "DeployedOn desc",
        top: 10,
        skip: 5,
      });
      expect(mockODataClient.getCollection).toHaveBeenCalledWith(
        "/api/v1/IntegrationRuntimeArtifacts",
        {
          $filter: "Status eq 'ERROR'",
          $select: "Id,Name",
          $orderby: "DeployedOn desc",
          $top: 10,
          $skip: 5,
        }
      );
    });

    it("returns isError on failure", async () => {
      mockODataClient.getCollection.mockRejectedValue(
        new Error("OData error (500): internal server error")
      );
      const result = await handlers.get("list_runtime_artifacts")!({});
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (500)");
    });
  });

  describe("get_runtime_artifact", () => {
    it("returns formatted artifact with parsed date", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        Id: "flow1",
        Name: "My Flow",
        Version: "1.0.0",
        Type: "INTEGRATION_FLOW",
        Status: "STARTED",
        DeployedBy: "admin",
        DeployedOn: "/Date(1711900800000)/",
      });

      const result = await handlers.get("get_runtime_artifact")!({
        id: "flow1",
      });
      const text = result.content[0].text;
      expect(text).toContain("Id: flow1");
      expect(text).toContain("Name: My Flow");
      expect(text).toContain("Version: 1.0.0");
      expect(text).toContain("Type: INTEGRATION_FLOW");
      expect(text).toContain("Status: STARTED");
      expect(text).toContain("DeployedBy: admin");
      // Verify OData date is parsed to ISO string
      expect(text).toContain("DeployedOn: 2024-");
      expect(text).not.toContain("/Date(");
    });

    it("calls correct path with escaped id", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        Id: "flow1",
        Name: "My Flow",
        Version: "1.0.0",
        Type: "INTEGRATION_FLOW",
        Status: "STARTED",
        DeployedBy: "admin",
        DeployedOn: null,
      });
      await handlers.get("get_runtime_artifact")!({ id: "flow1" });
      expect(mockODataClient.getEntity).toHaveBeenCalledWith(
        "/api/v1/IntegrationRuntimeArtifacts('flow1')"
      );
    });

    it("returns isError on 404", async () => {
      mockODataClient.getEntity.mockRejectedValue(
        new Error("OData error (404): Resource not found")
      );
      const result = await handlers.get("get_runtime_artifact")!({
        id: "nonexistent",
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (404)");
    });
  });

  describe("count_runtime_artifacts", () => {
    it("returns the count as text", async () => {
      mockODataClient.getValue.mockResolvedValue("42");
      const result = await handlers.get("count_runtime_artifacts")!({});
      expect(result.content[0].text).toBe("42");
    });

    it("calls count path without filter", async () => {
      mockODataClient.getValue.mockResolvedValue("10");
      await handlers.get("count_runtime_artifacts")!({});
      expect(mockODataClient.getValue).toHaveBeenCalledWith(
        "/api/v1/IntegrationRuntimeArtifacts/$count"
      );
    });

    it("appends filter to count path when provided", async () => {
      mockODataClient.getValue.mockResolvedValue("5");
      await handlers.get("count_runtime_artifacts")!({
        filter: "Status eq 'ERROR'",
      });
      expect(mockODataClient.getValue).toHaveBeenCalledWith(
        "/api/v1/IntegrationRuntimeArtifacts/$count?$filter=Status%20eq%20'ERROR'"
      );
    });

    it("returns isError on failure", async () => {
      mockODataClient.getValue.mockRejectedValue(
        new Error("OData error (500): internal server error")
      );
      const result = await handlers.get("count_runtime_artifacts")!({});
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (500)");
    });
  });

  describe("get_runtime_artifact_error", () => {
    it("returns error text", async () => {
      mockODataClient.getValue.mockResolvedValue(
        "com.sap.it.rt.adapter.http.exception: Connection refused"
      );
      const result = await handlers.get("get_runtime_artifact_error")!({
        id: "flow1",
      });
      expect(result.content[0].text).toContain("Connection refused");
    });

    it("returns 'No error information' when empty string", async () => {
      mockODataClient.getValue.mockResolvedValue("");
      const result = await handlers.get("get_runtime_artifact_error")!({
        id: "flow1",
      });
      expect(result.content[0].text).toBe(
        "No error information available."
      );
    });

    it("calls correct error path", async () => {
      mockODataClient.getValue.mockResolvedValue("some error");
      await handlers.get("get_runtime_artifact_error")!({ id: "flow1" });
      expect(mockODataClient.getValue).toHaveBeenCalledWith(
        "/api/v1/IntegrationRuntimeArtifacts('flow1')/ErrorInformation/$value"
      );
    });

    it("returns isError on failure", async () => {
      mockODataClient.getValue.mockRejectedValue(
        new Error("OData error (404): Resource not found")
      );
      const result = await handlers.get("get_runtime_artifact_error")!({
        id: "nonexistent",
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (404)");
    });
  });

  describe("undeploy_runtime_artifact", () => {
    it("shows preview without confirm", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        Id: "flow1",
        Name: "My Flow",
        Version: "1.0.0",
        Type: "INTEGRATION_FLOW",
        Status: "STARTED",
        DeployedBy: "admin",
        DeployedOn: "/Date(1711900800000)/",
      });

      const result = await handlers.get("undeploy_runtime_artifact")!({
        id: "flow1",
      });
      const text = result.content[0].text;
      expect(text).toContain("Artifact to undeploy:");
      expect(text).toContain("Id: flow1");
      expect(text).toContain("Name: My Flow");
      expect(text).toContain("Set confirm to true to proceed.");
      expect(mockODataClient.delete).not.toHaveBeenCalled();
    });

    it("executes undeploy with confirm", async () => {
      mockODataClient.delete.mockResolvedValue(undefined);
      const result = await handlers.get("undeploy_runtime_artifact")!({
        id: "flow1",
        confirm: true,
      });
      expect(mockODataClient.delete).toHaveBeenCalledWith(
        "/api/v1/IntegrationRuntimeArtifacts('flow1')"
      );
      expect(result.content[0].text).toContain("undeployed successfully");
    });

    it("returns isError when preview fetch fails", async () => {
      mockODataClient.getEntity.mockRejectedValue(
        new Error("OData error (404): Resource not found")
      );
      const result = await handlers.get("undeploy_runtime_artifact")!({
        id: "nonexistent",
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (404)");
    });

    it("returns isError when delete fails", async () => {
      mockODataClient.delete.mockRejectedValue(
        new Error("OData error (403): Forbidden")
      );
      const result = await handlers.get("undeploy_runtime_artifact")!({
        id: "flow1",
        confirm: true,
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (403)");
    });
  });
});

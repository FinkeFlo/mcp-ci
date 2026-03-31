import { describe, it, expect, vi, beforeEach } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerVariableTools } from "../tools/variables.js";
import type { ModuleContext } from "../../../core/types.js";

describe("variable tools", () => {
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

    registerVariableTools(mockServer, context);
  });

  it("registers all 4 tools", () => {
    expect(handlers.size).toBe(4);
    expect(handlers.has("list_variables")).toBe(true);
    expect(handlers.has("get_variable")).toBe(true);
    expect(handlers.has("delete_variable")).toBe(true);
    expect(handlers.has("download_variable")).toBe(true);
  });

  describe("list_variables", () => {
    it("returns formatted variables", async () => {
      mockODataClient.getCollection.mockResolvedValue([
        {
          VariableName: "var1",
          IntegrationFlow: "Flow1",
          Visibility: "Integration Flow",
          UpdatedAt: "2021-02-15T16:06:34.08",
          RetainUntil: "2021-05-15T16:06:34.08",
        },
        {
          VariableName: "var2",
          IntegrationFlow: "Flow2",
          Visibility: "Global",
          UpdatedAt: null,
          RetainUntil: null,
        },
      ]);

      const result = await handlers.get("list_variables")!({});
      const text = result.content[0].text;
      expect(text).toContain("VariableName: var1");
      expect(text).toContain("IntegrationFlow: Flow1");
      expect(text).toContain("Visibility: Integration Flow");
      expect(text).toContain("VariableName: var2");
      expect(text).toContain("UpdatedAt: n/a");
    });

    it("returns empty message when no variables found", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      const result = await handlers.get("list_variables")!({});
      expect(result.content[0].text).toBe("No variables found.");
    });

    it("returns isError on failure", async () => {
      mockODataClient.getCollection.mockRejectedValue(
        new Error("OData error (500): internal")
      );
      const result = await handlers.get("list_variables")!({});
      expect(result.isError).toBe(true);
    });
  });

  describe("get_variable", () => {
    it("returns formatted variable", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        VariableName: "myVar",
        IntegrationFlow: "Flow1",
        Visibility: "Global",
        UpdatedAt: "2021-02-15T16:06:34.08",
        RetainUntil: "2021-05-15T16:06:34.08",
      });

      const result = await handlers.get("get_variable")!({
        variableName: "myVar",
        integrationFlow: "Flow1",
      });
      const text = result.content[0].text;
      expect(text).toContain("VariableName: myVar");
      expect(text).toContain("Visibility: Global");
    });

    it("calls correct composite key path", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        VariableName: "v",
        IntegrationFlow: "f",
        Visibility: "Global",
        UpdatedAt: null,
        RetainUntil: null,
      });
      await handlers.get("get_variable")!({
        variableName: "v",
        integrationFlow: "f",
      });
      expect(mockODataClient.getEntity).toHaveBeenCalledWith(
        "/api/v1/Variables(VariableName='v',IntegrationFlow='f')"
      );
    });

    it("returns isError on 404", async () => {
      mockODataClient.getEntity.mockRejectedValue(
        new Error("OData error (404): Not found")
      );
      const result = await handlers.get("get_variable")!({
        variableName: "x",
        integrationFlow: "y",
      });
      expect(result.isError).toBe(true);
    });
  });

  describe("delete_variable", () => {
    it("shows preview without confirm", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        VariableName: "myVar",
        IntegrationFlow: "Flow1",
        Visibility: "Global",
        UpdatedAt: "2021-02-15T16:06:34.08",
        RetainUntil: "2021-05-15T16:06:34.08",
      });

      const result = await handlers.get("delete_variable")!({
        variableName: "myVar",
        integrationFlow: "Flow1",
      });
      const text = result.content[0].text;
      expect(text).toContain("Variable to delete:");
      expect(text).toContain("VariableName: myVar");
      expect(text).toContain("Set confirm to true to proceed.");
      expect(mockODataClient.delete).not.toHaveBeenCalled();
    });

    it("deletes variable with confirm", async () => {
      mockODataClient.delete.mockResolvedValue(undefined);
      const result = await handlers.get("delete_variable")!({
        variableName: "myVar",
        integrationFlow: "Flow1",
        confirm: true,
      });
      expect(mockODataClient.delete).toHaveBeenCalledWith(
        "/api/v1/Variables(VariableName='myVar',IntegrationFlow='Flow1')"
      );
      expect(result.content[0].text).toContain("deleted successfully");
    });

    it("returns isError when preview fetch fails", async () => {
      mockODataClient.getEntity.mockRejectedValue(
        new Error("OData error (404): Not found")
      );
      const result = await handlers.get("delete_variable")!({
        variableName: "x",
        integrationFlow: "y",
      });
      expect(result.isError).toBe(true);
    });

    it("returns isError when delete fails", async () => {
      mockODataClient.delete.mockRejectedValue(
        new Error("OData error (403): Forbidden")
      );
      const result = await handlers.get("delete_variable")!({
        variableName: "myVar",
        integrationFlow: "Flow1",
        confirm: true,
      });
      expect(result.isError).toBe(true);
    });
  });

  describe("download_variable", () => {
    it("returns variable content", async () => {
      mockODataClient.getValue.mockResolvedValue("variable-value-123");
      const result = await handlers.get("download_variable")!({
        variableName: "myVar",
        integrationFlow: "Flow1",
      });
      expect(result.content[0].text).toBe("variable-value-123");
    });

    it("returns no content message for empty result", async () => {
      mockODataClient.getValue.mockResolvedValue("");
      const result = await handlers.get("download_variable")!({
        variableName: "myVar",
        integrationFlow: "Flow1",
      });
      expect(result.content[0].text).toBe("No variable content available.");
    });

    it("calls correct value path", async () => {
      mockODataClient.getValue.mockResolvedValue("data");
      await handlers.get("download_variable")!({
        variableName: "myVar",
        integrationFlow: "Flow1",
      });
      expect(mockODataClient.getValue).toHaveBeenCalledWith(
        "/api/v1/Variables(VariableName='myVar',IntegrationFlow='Flow1')/$value"
      );
    });

    it("returns isError on failure", async () => {
      mockODataClient.getValue.mockRejectedValue(
        new Error("OData error (404): Not found")
      );
      const result = await handlers.get("download_variable")!({
        variableName: "x",
        integrationFlow: "y",
      });
      expect(result.isError).toBe(true);
    });
  });
});

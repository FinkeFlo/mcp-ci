import { describe, it, expect, vi, beforeEach } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerDeployStatusTools } from "../tools/deploy-status.js";
import type { ModuleContext } from "../../../core/types.js";

describe("deploy status tools", () => {
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

    registerDeployStatusTools(mockServer, context);
  });

  it("registers 1 tool", () => {
    expect(handlers.size).toBe(1);
    expect(handlers.has("get_deploy_status")).toBe(true);
  });

  describe("get_deploy_status", () => {
    it("returns formatted status", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        TaskId: "task-123",
        Status: "SUCCESS",
      });

      const result = await handlers.get("get_deploy_status")!({
        taskId: "task-123",
      });
      const text = result.content[0].text;
      expect(text).toContain("TaskId: task-123");
      expect(text).toContain("Status: SUCCESS");
    });

    it("calls correct path with escaped taskId", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        TaskId: "task-456",
        Status: "DEPLOYING",
      });
      await handlers.get("get_deploy_status")!({ taskId: "task-456" });
      expect(mockODataClient.getEntity).toHaveBeenCalledWith(
        "/api/v1/BuildAndDeployStatus(TaskId='task-456')"
      );
    });

    it("returns isError on failure", async () => {
      mockODataClient.getEntity.mockRejectedValue(
        new Error("OData error (404): Resource not found")
      );
      const result = await handlers.get("get_deploy_status")!({
        taskId: "nonexistent",
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (404)");
    });
  });
});

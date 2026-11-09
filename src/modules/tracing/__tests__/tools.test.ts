import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/server";
import { tracingModule } from "../tools.js";
import type { ModuleContext } from "../../../core/types.js";

describe("tracing tools", () => {
  let handlers: Map<string, (...args: any[]) => any>;
  let mockODataClient: {
    getCollection: ReturnType<typeof vi.fn>;
    getValue: ReturnType<typeof vi.fn>;
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
      getValue: vi.fn(),
    };

    const context = {
      tenantManager: {} as any,
      odataClient: mockODataClient as any,
    } satisfies ModuleContext;

    tracingModule.register(mockServer, context);
  });

  describe("get_message_runs", () => {
    it("returns no-runs text when empty", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      const result = await handlers.get("get_message_runs")!({ messageGuid: "g1" });
      expect(result.content[0].text).toContain("No runs found");
    });

    it("formats runs with index", async () => {
      mockODataClient.getCollection.mockResolvedValue([
        { Id: "run-1", OverallState: "COMPLETED", LogLevel: "TRACE", RunStart: "t1", RunStop: "t2" },
        { Id: "run-2", OverallState: "FAILED", LogLevel: "INFO", RunStart: "t3", RunStop: "t4" },
      ]);
      const result = await handlers.get("get_message_runs")!({ messageGuid: "g1" });
      const text = result.content[0].text;
      expect(text).toContain("2 run(s)");
      expect(text).toContain("[Run 1]");
      expect(text).toContain("run-1");
      expect(text).toContain("[Run 2]");
      expect(text).toContain("FAILED");
    });
  });

  describe("get_message_runs without server-side ordering", () => {
    it("sends no $orderby (the API answers 501) and sorts newest first itself", async () => {
      mockODataClient.getCollection.mockResolvedValue([
        { Id: "old", RunStart: "/Date(1000)/" },
        { Id: "new", RunStart: "/Date(3000)/" },
        { Id: "mid", RunStart: "/Date(2000)/" },
      ]);
      const result = await handlers.get("get_message_runs")!({ messageGuid: "g1" });
      const [, params] = mockODataClient.getCollection.mock.calls[0];
      expect(params?.$orderby).toBeUndefined();
      const text = result.content[0].text;
      expect(text.indexOf("new")).toBeLessThan(text.indexOf("mid"));
      expect(text.indexOf("mid")).toBeLessThan(text.indexOf("old"));
    });
  });

  describe("get_run_steps without server-side ordering", () => {
    it("sends no $orderby (the API answers 501) and sorts by ChildCount itself", async () => {
      mockODataClient.getCollection.mockResolvedValue([
        { RunId: "r1", ChildCount: 3, Activity: "Third", Status: "COMPLETED" },
        { RunId: "r1", ChildCount: 1, Activity: "First", Status: "COMPLETED" },
        { RunId: "r1", ChildCount: 2, Activity: "Second", Status: "COMPLETED" },
      ]);
      const result = await handlers.get("get_run_steps")!({ runId: "r1" });
      const [, params] = mockODataClient.getCollection.mock.calls[0];
      expect(params?.$orderby).toBeUndefined();
      const text = result.content[0].text;
      expect(text.indexOf("First")).toBeLessThan(text.indexOf("Second"));
      expect(text.indexOf("Second")).toBeLessThan(text.indexOf("Third"));
    });
  });

  describe("get_run_steps", () => {
    it("returns no-steps text when empty", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      const result = await handlers.get("get_run_steps")!({ runId: "r1" });
      expect(result.content[0].text).toContain("No steps found");
    });

    it("includes error text for failed steps", async () => {
      mockODataClient.getCollection.mockResolvedValue([
        {
          RunId: "r1", ChildCount: 0, Activity: "Mapping",
          Status: "ERROR", StepStart: "t1", StepStop: "t2",
          StepId: "s1", ModelStepId: "m1", BranchId: null,
          Error: "Mapping failed: field X missing",
        },
      ]);
      const result = await handlers.get("get_run_steps")!({ runId: "r1" });
      expect(result.content[0].text).toContain("Mapping failed");
    });
  });

  describe("get_trace", () => {
    it("returns no-trace text when empty", async () => {
      mockODataClient.getCollection.mockResolvedValueOnce([]);
      const result = await handlers.get("get_trace")!({ runId: "r1", childCount: 0 });
      expect(result.content[0].text).toContain("No trace data");
    });

    it("fetches payload, headers, and exchange properties", async () => {
      mockODataClient.getCollection
        .mockResolvedValueOnce([
          { TraceId: "100", MplId: "m1", ModelStepId: "ms1", PayloadSize: "50", MimeType: "application/xml" },
        ])
        .mockResolvedValueOnce([{ TraceId: "100", Name: "Content-Type", Value: "application/xml" }])
        .mockResolvedValueOnce([{ TraceId: "100", Name: "SAP_MessageId", Value: "abc" }]);
      mockODataClient.getValue.mockResolvedValue("<root>payload</root>");

      const result = await handlers.get("get_trace")!({ runId: "r1", childCount: 0 });
      const text = result.content[0].text;
      expect(text).toContain("application/xml");
      expect(text).toContain("<root>payload</root>");
      expect(text).toContain("Content-Type: application/xml");
      expect(text).toContain("SAP_MessageId: abc");
    });

    it("truncates payloads exceeding 100KB", async () => {
      mockODataClient.getCollection
        .mockResolvedValueOnce([
          { TraceId: "100", MplId: "m1", ModelStepId: "ms1", PayloadSize: "200000", MimeType: "text/xml" },
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await handlers.get("get_trace")!({ runId: "r1", childCount: 0 });
      const text = result.content[0].text;
      expect(text).toContain("TRUNCATED");
      expect(text).toContain("200000");
      expect(mockODataClient.getValue).not.toHaveBeenCalled();
    });

    it("handles property fetch failures gracefully", async () => {
      mockODataClient.getCollection
        .mockResolvedValueOnce([
          { TraceId: "100", MplId: "m1", ModelStepId: "ms1", PayloadSize: "10", MimeType: "text/plain" },
        ])
        .mockRejectedValueOnce(new Error("fail"))
        .mockRejectedValueOnce(new Error("fail"));
      mockODataClient.getValue.mockResolvedValue("hello");

      const result = await handlers.get("get_trace")!({ runId: "r1", childCount: 0 });
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("hello");
    });
  });
});

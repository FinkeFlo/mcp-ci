import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/server";
import { logfilesModule } from "../tools.js";
import type { ModuleContext } from "../../../core/types.js";

describe("logfiles tools", () => {
  let handlers: Map<string, (...args: any[]) => any>;
  let mockODataClient: {
    getCollection: ReturnType<typeof vi.fn>;
    getEntity: ReturnType<typeof vi.fn>;
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
      getEntity: vi.fn(),
      getValue: vi.fn(),
    };

    const context = {
      tenantManager: {} as any,
      odataClient: mockODataClient as any,
    } satisfies ModuleContext;

    logfilesModule.register(mockServer, context);
  });

  it("registers all 6 tools", () => {
    expect(handlers.size).toBe(6);
    expect(handlers.has("list_log_file_archives")).toBe(true);
    expect(handlers.has("get_log_file_archive")).toBe(true);
    expect(handlers.has("download_log_file_archive")).toBe(true);
    expect(handlers.has("list_log_files")).toBe(true);
    expect(handlers.has("get_log_file")).toBe(true);
    expect(handlers.has("download_log_file")).toBe(true);
  });

  describe("list_log_file_archives", () => {
    it("returns formatted archives", async () => {
      mockODataClient.getCollection.mockResolvedValue([
        {
          Scope: "all",
          LogFileType: "http",
          NodeScope: "worker",
          ContentType: "application/zip",
        },
        {
          Scope: "latest",
          LogFileType: "trace",
          NodeScope: "worker",
          ContentType: "application/zip",
        },
      ]);
      const result = await handlers.get("list_log_file_archives")!({});
      const text = result.content[0].text;
      expect(text).toContain("Scope: all");
      expect(text).toContain("LogFileType: http");
      expect(text).toContain("Scope: latest");
      expect(text).toContain("LogFileType: trace");
      expect(text).toContain("NodeScope: worker");
      expect(text).toContain("ContentType: application/zip");
    });

    it("returns empty message when no archives", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      const result = await handlers.get("list_log_file_archives")!({});
      expect(result.content[0].text).toBe("No log file archives found.");
    });

    it("returns isError on failure", async () => {
      mockODataClient.getCollection.mockRejectedValue(
        new Error("OData error (500): internal server error")
      );
      const result = await handlers.get("list_log_file_archives")!({});
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error");
    });
  });

  describe("get_log_file_archive", () => {
    it("returns formatted archive entity", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        Scope: "all",
        LogFileType: "http",
        NodeScope: "worker",
        ContentType: "application/zip",
      });
      const result = await handlers.get("get_log_file_archive")!({
        scope: "all",
        logFileType: "http",
      });
      const text = result.content[0].text;
      expect(text).toContain("Scope: all");
      expect(text).toContain("LogFileType: http");
      expect(text).toContain("NodeScope: worker");
    });

    it("returns isError on failure", async () => {
      mockODataClient.getEntity.mockRejectedValue(
        new Error("OData error (404): not found")
      );
      const result = await handlers.get("get_log_file_archive")!({
        scope: "all",
        logFileType: "http",
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error");
    });
  });

  describe("download_log_file_archive", () => {
    it("returns content length info", async () => {
      mockODataClient.getValue.mockResolvedValue("fake-zip-content-bytes");
      const result = await handlers.get("download_log_file_archive")!({
        scope: "all",
        logFileType: "http",
      });
      const text = result.content[0].text;
      expect(text).toContain("Log file archive downloaded");
      expect(text).toContain("ZIP format");
    });

    it("appends modifiedAfter query param when provided", async () => {
      mockODataClient.getValue.mockResolvedValue("zip-data");
      await handlers.get("download_log_file_archive")!({
        scope: "latest",
        logFileType: "trace",
        modifiedAfter: "2026-03-30T00:00:00Z",
      });
      const calledPath = mockODataClient.getValue.mock.calls[0][0];
      expect(calledPath).toContain("/$value?ModifiedAfter=2026-03-30T00:00:00Z");
    });

    it("does not append query param when modifiedAfter is absent", async () => {
      mockODataClient.getValue.mockResolvedValue("zip-data");
      await handlers.get("download_log_file_archive")!({
        scope: "all",
        logFileType: "http",
      });
      const calledPath = mockODataClient.getValue.mock.calls[0][0];
      expect(calledPath).not.toContain("?");
    });

    it("returns isError on failure", async () => {
      mockODataClient.getValue.mockRejectedValue(
        new Error("OData error (500): internal server error")
      );
      const result = await handlers.get("download_log_file_archive")!({
        scope: "all",
        logFileType: "http",
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error");
    });
  });

  describe("list_log_files", () => {
    it("returns formatted log files with parsed dates and human-readable size", async () => {
      mockODataClient.getCollection.mockResolvedValue([
        {
          Name: "ljs_trace_2026-03-31.log",
          Application: "myapp",
          LastModified: "/Date(1743379200000)/",
          ContentType: "text/plain",
          LogFileType: "trace",
          NodeScope: "worker",
          Size: "204800",
        },
      ]);
      const result = await handlers.get("list_log_files")!({});
      const text = result.content[0].text;
      expect(text).toContain("Name: ljs_trace_2026-03-31.log");
      expect(text).toContain("Application: myapp");
      expect(text).toContain("LogFileType: trace");
      expect(text).toContain("2026-03-31");
      expect(text).toContain("200.0 KB");
      expect(text).toContain("NodeScope: worker");
    });

    it("returns empty message when no files", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      const result = await handlers.get("list_log_files")!({});
      expect(result.content[0].text).toBe("No log files found.");
    });

    it("passes query params to OData client", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      await handlers.get("list_log_files")!({
        filter: "LogFileType eq 'trace'",
        orderby: "LastModified desc",
        select: "Name,Application",
        top: 10,
        skip: 5,
      });
      expect(mockODataClient.getCollection).toHaveBeenCalledWith(
        "/api/v1/LogFiles",
        {
          $filter: "LogFileType eq 'trace'",
          $orderby: "LastModified desc",
          $select: "Name,Application",
          $top: 10,
          $skip: 5,
        }
      );
    });

    it("returns isError on failure", async () => {
      mockODataClient.getCollection.mockRejectedValue(
        new Error("OData error (403): forbidden")
      );
      const result = await handlers.get("list_log_files")!({});
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error");
    });
  });

  describe("get_log_file", () => {
    it("returns formatted log file with parsed date", async () => {
      mockODataClient.getEntity.mockResolvedValue({
        Name: "http_access_2026-03-31.log",
        Application: "myapp",
        LastModified: "/Date(1743379200000)/",
        ContentType: "text/plain",
        LogFileType: "http",
        NodeScope: "worker",
        Size: "1048576",
      });
      const result = await handlers.get("get_log_file")!({
        name: "http_access_2026-03-31.log",
        application: "myapp",
      });
      const text = result.content[0].text;
      expect(text).toContain("Name: http_access_2026-03-31.log");
      expect(text).toContain("Application: myapp");
      expect(text).toContain("2026-03-31");
      expect(text).toContain("1.0 MB");
    });

    it("returns isError on failure", async () => {
      mockODataClient.getEntity.mockRejectedValue(
        new Error("OData error (404): not found")
      );
      const result = await handlers.get("get_log_file")!({
        name: "missing.log",
        application: "app",
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error");
    });
  });

  describe("download_log_file", () => {
    it("returns file content", async () => {
      mockODataClient.getValue.mockResolvedValue(
        "2026-03-31 10:00:00 INFO Some log entry"
      );
      const result = await handlers.get("download_log_file")!({
        name: "trace.log",
        application: "myapp",
      });
      expect(result.content[0].text).toContain("Some log entry");
    });

    it("returns isError on failure", async () => {
      mockODataClient.getValue.mockRejectedValue(
        new Error("OData error (500): internal server error")
      );
      const result = await handlers.get("download_log_file")!({
        name: "trace.log",
        application: "myapp",
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error");
    });
  });
});

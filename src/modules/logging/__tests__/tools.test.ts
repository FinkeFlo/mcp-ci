import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loggingModule } from "../tools.js";
import type { ModuleContext } from "../../../core/types.js";

describe("logging tools", () => {
  let handlers: Map<string, (...args: any[]) => any>;
  let mockODataClient: {
    getValue: ReturnType<typeof vi.fn>;
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

    loggingModule.register(mockServer, context);
  });

  describe("get_external_logging_status", () => {
    it("returns ACTIVE when active field is true (standard OData format)", async () => {
      mockODataClient.getValue.mockResolvedValue(
        JSON.stringify({ d: { Id: "DEV", Active: true } })
      );
      const result = await handlers.get("get_external_logging_status")!({});
      expect(result.content[0].text).toBe("External logging is ACTIVE");
    });

    it("returns INACTIVE when active field is false (standard OData format)", async () => {
      mockODataClient.getValue.mockResolvedValue(
        JSON.stringify({ d: { Id: "DEV", Active: false } })
      );
      const result = await handlers.get("get_external_logging_status")!({});
      expect(result.content[0].text).toBe("External logging is INACTIVE");
    });

    it("returns ACTIVE when active field is true (non-standard entry format)", async () => {
      mockODataClient.getValue.mockResolvedValue(
        JSON.stringify({
          entry: { content: { properties: { Id: "DEV", Active: true } } },
        })
      );
      const result = await handlers.get("get_external_logging_status")!({});
      expect(result.content[0].text).toBe("External logging is ACTIVE");
    });

    it("returns INACTIVE when active field is false (non-standard entry format)", async () => {
      mockODataClient.getValue.mockResolvedValue(
        JSON.stringify({
          entry: { content: { properties: { Id: "DEV", Active: false } } },
        })
      );
      const result = await handlers.get("get_external_logging_status")!({});
      expect(result.content[0].text).toBe("External logging is INACTIVE");
    });

    it("uses tenant name from tenantManager in URL", async () => {
      mockODataClient.getValue.mockResolvedValue(
        JSON.stringify({ d: { Active: true } })
      );
      await handlers.get("get_external_logging_status")!({});
      expect(mockODataClient.getValue).toHaveBeenCalledWith(
        "/api/v1/ExternalLoggingActivationStatus('DEV')"
      );
    });

    it("returns isError on OData failure", async () => {
      mockODataClient.getValue.mockRejectedValue(
        new Error("OData error (500): internal server error")
      );
      const result = await handlers.get("get_external_logging_status")!({});
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error");
    });
  });

  describe("activate_external_logging", () => {
    it("without confirm shows current status and preview message", async () => {
      mockODataClient.getValue.mockResolvedValue(
        JSON.stringify({ d: { Active: false } })
      );
      const result = await handlers.get("activate_external_logging")!({
        logLevel: "INFO",
      });
      const text = result.content[0].text;
      expect(text).toContain("External logging is INACTIVE");
      expect(text).toContain("activate external logging with level INFO");
      expect(text).toContain("confirm: true");
      expect(mockODataClient.post).not.toHaveBeenCalled();
    });

    it("with confirm calls post with correct URL for INFO level", async () => {
      mockODataClient.post.mockResolvedValue({ message: "Activation successful." });
      const result = await handlers.get("activate_external_logging")!({
        logLevel: "INFO",
        confirm: true,
      });
      expect(mockODataClient.post).toHaveBeenCalledWith(
        "/api/v1/activateExternalLogging?defaultLogLevel=INFO"
      );
      expect(result.content[0].text).toContain("Activation successful.");
    });

    it("with confirm calls post with correct URL for ERROR level", async () => {
      mockODataClient.post.mockResolvedValue({});
      await handlers.get("activate_external_logging")!({
        logLevel: "ERROR",
        confirm: true,
      });
      expect(mockODataClient.post).toHaveBeenCalledWith(
        "/api/v1/activateExternalLogging?defaultLogLevel=ERROR"
      );
    });

    it("with confirm calls post with correct URL for NONE level", async () => {
      mockODataClient.post.mockResolvedValue({});
      await handlers.get("activate_external_logging")!({
        logLevel: "NONE",
        confirm: true,
      });
      expect(mockODataClient.post).toHaveBeenCalledWith(
        "/api/v1/activateExternalLogging?defaultLogLevel=NONE"
      );
    });

    it("returns isError on post failure", async () => {
      mockODataClient.post.mockRejectedValue(
        new Error("OData error (403): forbidden")
      );
      const result = await handlers.get("activate_external_logging")!({
        logLevel: "INFO",
        confirm: true,
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (403)");
    });
  });

  describe("deactivate_external_logging", () => {
    it("without confirm shows current status and preview message", async () => {
      mockODataClient.getValue.mockResolvedValue(
        JSON.stringify({ d: { Active: true } })
      );
      const result = await handlers.get("deactivate_external_logging")!({});
      const text = result.content[0].text;
      expect(text).toContain("External logging is ACTIVE");
      expect(text).toContain("deactivate external logging");
      expect(text).toContain("confirm: true");
      expect(mockODataClient.post).not.toHaveBeenCalled();
    });

    it("with confirm calls deactivate endpoint", async () => {
      mockODataClient.post.mockResolvedValue({ message: "Deactivation successful." });
      const result = await handlers.get("deactivate_external_logging")!({
        confirm: true,
      });
      expect(mockODataClient.post).toHaveBeenCalledWith(
        "/api/v1/deactivateExternalLogging"
      );
      expect(result.content[0].text).toContain("Deactivation successful.");
    });

    it("returns isError on post failure", async () => {
      mockODataClient.post.mockRejectedValue(
        new Error("OData error (500): internal server error")
      );
      const result = await handlers.get("deactivate_external_logging")!({
        confirm: true,
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (500)");
    });
  });
});

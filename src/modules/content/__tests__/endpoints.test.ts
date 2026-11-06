import { describe, it, expect, vi, beforeEach } from "vitest";
import type { McpServer } from "@modelcontextprotocol/server";
import { registerEndpointTools } from "../tools/endpoints.js";
import type { ModuleContext } from "../../../core/types.js";

describe("service endpoint tools", () => {
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

    registerEndpointTools(mockServer, context);
  });

  it("registers all 2 tools", () => {
    expect(handlers.size).toBe(2);
    expect(handlers.has("list_service_endpoints")).toBe(true);
    expect(handlers.has("count_service_endpoints")).toBe(true);
  });

  describe("list_service_endpoints", () => {
    it("returns formatted endpoints", async () => {
      mockODataClient.getCollection.mockResolvedValue([
        {
          Name: "MyEndpoint",
          Id: "ep1",
          Title: "My Endpoint Title",
          Version: "1.0",
          Protocol: "REST",
          Summary: "A summary",
          Description: "A description",
          LastUpdated: "2024-03-31T10:00:00Z",
        },
        {
          Name: null,
          Id: "ep2",
          Title: "Other Endpoint",
          Version: "2.0",
          Protocol: "SOAP",
          Summary: "",
          Description: "",
          LastUpdated: null,
        },
      ]);

      const result = await handlers.get("list_service_endpoints")!({});
      const text = result.content[0].text;
      expect(text).toContain("Name: MyEndpoint");
      expect(text).toContain("Id: ep1");
      expect(text).toContain("Title: My Endpoint Title");
      expect(text).toContain("Version: 1.0");
      expect(text).toContain("Protocol: REST");
      expect(text).toContain("LastUpdated: 2024-03-31T10:00:00Z");
      expect(text).toContain("Name: n/a");
      expect(text).toContain("Id: ep2");
      expect(text).toContain("Protocol: SOAP");
      expect(text).toContain("LastUpdated: n/a");
    });

    it("returns empty message when no endpoints found", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      const result = await handlers.get("list_service_endpoints")!({});
      expect(result.content[0].text).toBe("No service endpoints found.");
    });

    it("passes query params to OData client", async () => {
      mockODataClient.getCollection.mockResolvedValue([]);
      await handlers.get("list_service_endpoints")!({
        filter: "Protocol eq 'REST'",
        select: "Name,Id,Protocol",
        expand: "EntryPoints",
        top: 10,
        skip: 5,
      });
      expect(mockODataClient.getCollection).toHaveBeenCalledWith(
        "/api/v1/ServiceEndpoints",
        {
          $filter: "Protocol eq 'REST'",
          $select: "Name,Id,Protocol",
          $expand: "EntryPoints",
          $top: 10,
          $skip: 5,
        }
      );
    });

    it("returns isError on failure", async () => {
      mockODataClient.getCollection.mockRejectedValue(
        new Error("OData error (500): internal server error")
      );
      const result = await handlers.get("list_service_endpoints")!({});
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (500)");
    });
  });

  describe("count_service_endpoints", () => {
    it("returns the count as text", async () => {
      mockODataClient.getValue.mockResolvedValue("15");
      const result = await handlers.get("count_service_endpoints")!({});
      expect(result.content[0].text).toBe("15");
    });

    it("calls correct count path", async () => {
      mockODataClient.getValue.mockResolvedValue("10");
      await handlers.get("count_service_endpoints")!({});
      expect(mockODataClient.getValue).toHaveBeenCalledWith(
        "/api/v1/ServiceEndpoints/$count"
      );
    });

    it("returns isError on failure", async () => {
      mockODataClient.getValue.mockRejectedValue(
        new Error("OData error (500): internal server error")
      );
      const result = await handlers.get("count_service_endpoints")!({});
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("OData error (500)");
    });
  });
});

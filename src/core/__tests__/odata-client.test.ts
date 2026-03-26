import { describe, it, expect, vi, beforeEach } from "vitest";
import { ODataClient } from "../odata-client.js";
import { Auth } from "../auth.js";
import { TenantManager } from "../tenant-manager.js";
import type { TenantConfig } from "../types.js";

const testConfig: TenantConfig = {
  tenants: {
    dev: {
      name: "DEV", apiUrl: "https://dev.example.com",
      oauthUrl: "https://dev.example.com/oauth/token",
      clientId: "test-id", clientSecret: "test-secret",
    },
  },
  defaultTenant: "dev",
};

describe("ODataClient", () => {
  let client: ODataClient;
  let auth: Auth;
  let tenantManager: TenantManager;

  beforeEach(() => {
    auth = new Auth();
    tenantManager = new TenantManager(testConfig);
    client = new ODataClient(auth, tenantManager);
    vi.restoreAllMocks();
    vi.spyOn(auth, "getToken").mockResolvedValue("mock-token");
  });

  it("makes authenticated GET request with Accept: application/json", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true, json: async () => ({ d: { results: [{ MessageGuid: "abc" }] } }),
    } as Response);
    await client.getCollection("/api/v1/MessageProcessingLogs");
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://dev.example.com/api/v1/MessageProcessingLogs",
      expect.objectContaining({
        headers: expect.objectContaining({ Accept: "application/json", Authorization: "Bearer mock-token" }),
      })
    );
  });

  it("parses collection response (d.results)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true, json: async () => ({ d: { results: [{ MessageGuid: "abc" }, { MessageGuid: "def" }] } }),
    } as Response);
    const results = await client.getCollection("/api/v1/MessageProcessingLogs");
    expect(results).toEqual([{ MessageGuid: "abc" }, { MessageGuid: "def" }]);
  });

  it("parses single entity response (d)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true, json: async () => ({ d: { MessageGuid: "abc", Status: "COMPLETED" } }),
    } as Response);
    const result = await client.getEntity("/api/v1/MessageProcessingLogs('abc')");
    expect(result).toEqual({ MessageGuid: "abc", Status: "COMPLETED" });
  });

  it("fetches $value as text", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true, text: async () => "Error: Connection timeout",
    } as Response);
    const value = await client.getValue("/api/v1/MessageProcessingLogs('abc')/ErrorInformation/$value");
    expect(value).toBe("Error: Connection timeout");
  });

  it("builds query string from params", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true, json: async () => ({ d: { results: [] } }),
    } as Response);
    await client.getCollection("/api/v1/MessageProcessingLogs", {
      $filter: "Status eq 'FAILED'", $top: 50, $orderby: "LogEnd desc", $select: "MessageGuid,Status",
    });
    const calledUrl = (globalThis.fetch as any).mock.calls[0][0] as string;
    expect(calledUrl).toContain("$filter=Status%20eq%20'FAILED'");
    expect(calledUrl).toContain("$top=50");
    expect(calledUrl).toContain("$orderby=LogEnd%20desc");
    expect(calledUrl).toContain("$select=MessageGuid%2CStatus");
  });

  it("throws readable error on SAP OData error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false, status: 400, text: async () => JSON.stringify({ error: { message: { value: "Invalid filter expression" } } }),
    } as Response);
    await expect(client.getCollection("/api/v1/MessageProcessingLogs")).rejects.toThrow("OData error (400): Invalid filter expression");
  });

  it("handles non-JSON error response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false, status: 503, text: async () => "Service Unavailable",
    } as Response);
    await expect(client.getCollection("/api/v1/MessageProcessingLogs")).rejects.toThrow("OData error (503): Service Unavailable");
  });

  it("handles timeout errors", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("fetch failed"));
    await expect(client.getCollection("/api/v1/MessageProcessingLogs")).rejects.toThrow("fetch failed");
  });
});

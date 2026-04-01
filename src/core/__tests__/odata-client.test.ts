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

  describe("CSRF token handling", () => {
    it("fetches CSRF token from root endpoint", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch")
        // 1. CSRF fetch
        .mockResolvedValueOnce({
          ok: true,
          headers: new Headers({ "X-CSRF-Token": "csrf-token-value" }),
        } as Response)
        // 2. DELETE
        .mockResolvedValueOnce({
          ok: true,
          status: 204,
        } as Response);

      await client.delete("/api/v1/MessageProcessingLogs('abc')");

      expect(fetchSpy).toHaveBeenCalledTimes(2);

      // First call: CSRF fetch to root
      expect(fetchSpy.mock.calls[0][0]).toBe("https://dev.example.com/api/v1/");
      expect((fetchSpy.mock.calls[0][1] as RequestInit).headers).toMatchObject({
        "X-CSRF-Token": "Fetch",
      });

      // Second call: DELETE with CSRF token
      expect(fetchSpy.mock.calls[1][0]).toBe("https://dev.example.com/api/v1/MessageProcessingLogs('abc')");
      expect((fetchSpy.mock.calls[1][1] as RequestInit).method).toBe("DELETE");
      expect((fetchSpy.mock.calls[1][1] as RequestInit).headers).toMatchObject({
        "X-CSRF-Token": "csrf-token-value",
      });
    });

    it("caches CSRF token across multiple requests", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch")
        // 1. CSRF fetch (only once)
        .mockResolvedValueOnce({
          ok: true,
          headers: new Headers({ "X-CSRF-Token": "csrf-token-value" }),
        } as Response)
        // 2. First DELETE
        .mockResolvedValueOnce({
          ok: true,
          status: 204,
        } as Response)
        // 3. Second DELETE
        .mockResolvedValueOnce({
          ok: true,
          status: 204,
        } as Response);

      await client.delete("/api/v1/MessageProcessingLogs('abc')");
      await client.delete("/api/v1/MessageProcessingLogs('def')");

      // 1 CSRF fetch + 2 DELETEs = 3 total
      expect(fetchSpy).toHaveBeenCalledTimes(3);
    });

    it("refreshes CSRF token on 403", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch")
        // 1. Initial CSRF fetch
        .mockResolvedValueOnce({
          ok: true,
          headers: new Headers({ "X-CSRF-Token": "csrf-token-value" }),
        } as Response)
        // 2. First DELETE → 403
        .mockResolvedValueOnce({
          ok: false,
          status: 403,
          text: async () => "Forbidden",
        } as Response)
        // 3. CSRF re-fetch
        .mockResolvedValueOnce({
          ok: true,
          headers: new Headers({ "X-CSRF-Token": "new-csrf-token" }),
        } as Response)
        // 4. Retry DELETE → success
        .mockResolvedValueOnce({
          ok: true,
          status: 204,
        } as Response);

      await client.delete("/api/v1/MessageProcessingLogs('abc')");

      // 1 CSRF fetch + 1 failed DELETE + 1 CSRF re-fetch + 1 retry DELETE = 4
      expect(fetchSpy).toHaveBeenCalledTimes(4);

      // Final DELETE should use the new CSRF token
      expect((fetchSpy.mock.calls[3][1] as RequestInit).headers).toMatchObject({
        "X-CSRF-Token": "new-csrf-token",
      });
    });

    it("refreshes CSRF token on 403 for post()", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch")
        // 1. Initial CSRF fetch
        .mockResolvedValueOnce({
          ok: true,
          headers: new Headers({ "X-CSRF-Token": "old-token" }),
        } as Response)
        // 2. First POST → 403
        .mockResolvedValueOnce({
          ok: false,
          status: 403,
          text: async () => "Forbidden",
        } as Response)
        // 3. CSRF re-fetch
        .mockResolvedValueOnce({
          ok: true,
          headers: new Headers({ "X-CSRF-Token": "new-token" }),
        } as Response)
        // 4. Retry POST → success
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ d: { results: [] } }),
        } as Response);

      await client.post("/api/v1/activateExternalLogging");

      // 1 CSRF fetch + 1 failed POST + 1 CSRF re-fetch + 1 retry POST = 4
      expect(fetchSpy).toHaveBeenCalledTimes(4);

      // Final POST should use the new CSRF token
      expect((fetchSpy.mock.calls[3][1] as RequestInit).headers).toMatchObject({
        "X-CSRF-Token": "new-token",
      });
    });

    it("sends POST with CSRF token and JSON body", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch")
        // 1. CSRF fetch
        .mockResolvedValueOnce({
          ok: true,
          headers: new Headers({ "X-CSRF-Token": "csrf-token-value" }),
        } as Response)
        // 2. POST response
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ success: true }),
        } as Response);

      const result = await client.post("/api/v1/activateExternalLogging", { defaultLogLevel: "INFO" });

      expect(fetchSpy).toHaveBeenCalledTimes(2);

      // Second call: POST with CSRF token and JSON body
      const [postUrl, postInit] = fetchSpy.mock.calls[1] as [string, RequestInit];
      expect(postUrl).toBe("https://dev.example.com/api/v1/activateExternalLogging");
      expect(postInit.method).toBe("POST");
      expect((postInit.headers as Record<string, string>)["X-CSRF-Token"]).toBe("csrf-token-value");
      expect((postInit.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
      expect(postInit.body).toBe(JSON.stringify({ defaultLogLevel: "INFO" }));
      expect(result).toEqual({ success: true });
    });

    it("handles empty response body from POST (e.g. 201 Created)", async () => {
      vi.spyOn(globalThis, "fetch")
        // 1. CSRF fetch
        .mockResolvedValueOnce({
          ok: true,
          headers: new Headers({ "X-CSRF-Token": "csrf-token-value" }),
        } as Response)
        // 2. POST response — 201 with empty body
        .mockResolvedValueOnce({
          ok: true,
          status: 201,
          text: async () => "",
        } as Response);

      const result = await client.post("/api/v1/UserCredentials", { Name: "test", User: "user" });
      expect(result).toBeUndefined();
    });

    it("handles empty response body from POST after CSRF retry", async () => {
      vi.spyOn(globalThis, "fetch")
        // 1. Initial CSRF fetch
        .mockResolvedValueOnce({
          ok: true,
          headers: new Headers({ "X-CSRF-Token": "old-token" }),
        } as Response)
        // 2. POST → 403
        .mockResolvedValueOnce({
          ok: false,
          status: 403,
          text: async () => "Forbidden",
        } as Response)
        // 3. CSRF re-fetch
        .mockResolvedValueOnce({
          ok: true,
          headers: new Headers({ "X-CSRF-Token": "new-token" }),
        } as Response)
        // 4. Retry POST → 201 with empty body
        .mockResolvedValueOnce({
          ok: true,
          status: 201,
          text: async () => "",
        } as Response);

      const result = await client.post("/api/v1/UserCredentials", { Name: "test" });
      expect(result).toBeUndefined();
    });

    it("sends POST without body", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch")
        // 1. CSRF fetch
        .mockResolvedValueOnce({
          ok: true,
          headers: new Headers({ "X-CSRF-Token": "csrf-token-value" }),
        } as Response)
        // 2. POST response
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({}),
        } as Response);

      await client.post("/api/v1/deactivateExternalLogging");

      const [, postInit] = fetchSpy.mock.calls[1] as [string, RequestInit];
      expect(postInit.method).toBe("POST");
      expect(postInit.body).toBeUndefined();
      expect((postInit.headers as Record<string, string>)["Content-Type"]).toBeUndefined();
    });
  });
});

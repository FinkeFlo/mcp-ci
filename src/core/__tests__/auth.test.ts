import { describe, it, expect, vi, beforeEach } from "vitest";
import { Auth } from "../auth.js";
import type { Tenant } from "../types.js";

const mockTenant: Tenant = {
  name: "DEV",
  apiUrl: "https://dev.example.com",
  oauthUrl: "https://dev.example.com/oauth/token",
  clientId: "test-client-id",
  clientSecret: "test-client-secret",
};

describe("Auth", () => {
  let auth: Auth;

  beforeEach(() => {
    auth = new Auth();
    vi.restoreAllMocks();
  });

  it("fetches a new token via client_credentials grant", async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({ access_token: "test-token-123", token_type: "bearer", expires_in: 3600 }),
    };
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(mockResponse as Response);
    const token = await auth.getToken(mockTenant);
    expect(token).toBe("test-token-123");
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://dev.example.com/oauth/token",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "Content-Type": "application/x-www-form-urlencoded" }),
      })
    );
  });

  it("returns cached token on second call", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true, json: async () => ({ access_token: "test-token-123", expires_in: 3600 }),
    } as Response);
    await auth.getToken(mockTenant);
    await auth.getToken(mockTenant);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it("refreshes token when expired", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: "token-1", expires_in: 0 }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: "token-2", expires_in: 3600 }) } as Response);
    const token1 = await auth.getToken(mockTenant);
    const token2 = await auth.getToken(mockTenant);
    expect(token1).toBe("token-1");
    expect(token2).toBe("token-2");
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it("throws on auth failure", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false, status: 401, statusText: "Unauthorized", text: async () => "Invalid credentials",
    } as Response);
    await expect(auth.getToken(mockTenant)).rejects.toThrow("Auth failed for tenant DEV (401): Invalid credentials");
  });

  it("caches tokens per tenant", async () => {
    const tenant2: Tenant = { ...mockTenant, name: "QAS", clientId: "other-id" };
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: "token-dev", expires_in: 3600 }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: "token-qas", expires_in: 3600 }) } as Response);
    const t1 = await auth.getToken(mockTenant);
    const t2 = await auth.getToken(tenant2);
    expect(t1).toBe("token-dev");
    expect(t2).toBe("token-qas");
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });
});

describe("Auth cache key", () => {
  const response = (token: string) =>
    ({ ok: true, json: async () => ({ access_token: token, expires_in: 3600 }) }) as Response;

  it("does not share a token between tenants with the same client id but different token endpoints", async () => {
    const auth = new Auth();
    const other: Tenant = { ...mockTenant, name: "OTHER", oauthUrl: "https://other.example.com/oauth/token" };
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(response("token-dev"))
      .mockResolvedValueOnce(response("token-other"));
    expect(await auth.getToken(mockTenant)).toBe("token-dev");
    expect(await auth.getToken(other)).toBe("token-other");
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it("shares a token between tenants with the same token endpoint and client id", async () => {
    const auth = new Auth();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(response("token-dev"));
    await auth.getToken(mockTenant);
    await auth.getToken({ ...mockTenant, name: "ALIAS", apiUrl: "https://alias.example.com" });
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });
});

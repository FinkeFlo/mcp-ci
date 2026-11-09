import { describe, it, expect } from "vitest";
import { CsrfTokenCache } from "../csrf-cache.js";
import type { Principal } from "../extension-points.js";
import type { Tenant } from "../types.js";

const tenant: Tenant = {
  name: "T",
  apiUrl: "https://a.example.com",
  oauthUrl: "https://a.example.com/oauth/token",
  clientId: "c",
  clientSecret: "s",
};
const alice: Principal = { subject: "alice", roles: [], claims: {} };

describe("CsrfTokenCache.keyFor", () => {
  it("differs when only the API URL, only the client id or only the subject differs", () => {
    const base = CsrfTokenCache.keyFor(tenant, alice);
    expect(CsrfTokenCache.keyFor({ ...tenant, apiUrl: "https://b.example.com" }, alice)).not.toBe(base);
    expect(CsrfTokenCache.keyFor({ ...tenant, clientId: "other" }, alice)).not.toBe(base);
    expect(CsrfTokenCache.keyFor(tenant, { ...alice, subject: "bob" })).not.toBe(base);
    expect(CsrfTokenCache.keyFor({ ...tenant }, { ...alice })).toBe(base);
  });

  it("does not confuse parts that merely contain the separator", () => {
    const one = CsrfTokenCache.keyFor({ ...tenant, apiUrl: "a|b", clientId: "c" }, alice);
    const two = CsrfTokenCache.keyFor({ ...tenant, apiUrl: "a", clientId: "b|c" }, alice);
    expect(one).not.toBe(two);
  });
});

describe("CsrfTokenCache", () => {
  it("returns a stored token until 30 minutes have passed", () => {
    let now = 1_000;
    const cache = new CsrfTokenCache(() => now);
    cache.set("k", "token");
    now += 30 * 60_000 - 1;
    expect(cache.get("k")).toBe("token");
    now += 1;
    expect(cache.get("k")).toBeUndefined();
  });

  it("forgets a deleted token", () => {
    const cache = new CsrfTokenCache();
    cache.set("k", "token");
    cache.delete("k");
    expect(cache.get("k")).toBeUndefined();
  });
});

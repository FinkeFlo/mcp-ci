import type { Principal } from "./extension-points.js";
import type { Tenant } from "./types.js";

const CSRF_TTL_MS = 30 * 60_000;

/**
 * CSRF tokens by tenant API and person. One cache is shared by every session
 * of a process, so the key names everything a token depends on: the API URL,
 * the client id and the principal's subject.
 */
export class CsrfTokenCache {
  private entries = new Map<string, { token: string; fetchedAt: number }>();

  constructor(private now: () => number = Date.now) {}

  static keyFor(tenant: Tenant, principal: Principal): string {
    return JSON.stringify([tenant.apiUrl, tenant.clientId, principal.subject]);
  }

  get(key: string): string | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (this.now() - entry.fetchedAt >= CSRF_TTL_MS) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.token;
  }

  set(key: string, token: string): void {
    this.entries.set(key, { token, fetchedAt: this.now() });
  }

  delete(key: string): void {
    this.entries.delete(key);
  }
}

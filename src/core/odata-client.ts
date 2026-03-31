import type { Auth } from "./auth.js";
import type { TenantManager } from "./tenant-manager.js";

export interface ODataParams {
  $filter?: string;
  $select?: string;
  $expand?: string;
  $top?: number;
  $orderby?: string;
  $skip?: number;
  $inlinecount?: string;
  filterCustomHeaderProperties?: string;
}

export class ODataClient {
  private static CSRF_TTL = 30 * 60_000;
  private csrfTokens = new Map<string, { token: string; fetchedAt: number }>();

  constructor(private auth: Auth, private tenantManager: TenantManager) {}

  private async getCsrfToken(): Promise<string> {
    const tenant = this.tenantManager.getActiveTenant();
    const cached = this.csrfTokens.get(tenant.clientId);
    if (cached && Date.now() - cached.fetchedAt < ODataClient.CSRF_TTL) {
      return cached.token;
    }
    return this.fetchCsrfToken();
  }

  private async fetchCsrfToken(): Promise<string> {
    const tenant = this.tenantManager.getActiveTenant();
    const token = await this.auth.getToken(tenant);
    const url = `${tenant.apiUrl}/`;
    const response = await fetch(url, {
      headers: {
        "X-CSRF-Token": "Fetch",
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(this.formatError(response.status, errorText));
    }
    const csrfToken = response.headers.get("X-CSRF-Token");
    if (!csrfToken) {
      throw new Error("CSRF token missing from response headers");
    }
    this.csrfTokens.set(tenant.clientId, { token: csrfToken, fetchedAt: Date.now() });
    return csrfToken;
  }

  async post(path: string, body?: Record<string, unknown>): Promise<any> {
    const tenant = this.tenantManager.getActiveTenant();
    const token = await this.auth.getToken(tenant);
    const csrfToken = await this.getCsrfToken();
    const url = `${tenant.apiUrl}${path}`;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "X-CSRF-Token": csrfToken,
    };
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30_000),
    });

    if (response.status === 403) {
      // Invalidate cached token and retry once
      this.csrfTokens.delete(tenant.clientId);
      const newCsrfToken = await this.fetchCsrfToken();
      const retryHeaders: Record<string, string> = {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "X-CSRF-Token": newCsrfToken,
      };
      if (body !== undefined) {
        retryHeaders["Content-Type"] = "application/json";
      }
      const retryResponse = await fetch(url, {
        method: "POST",
        headers: retryHeaders,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(30_000),
      });
      if (!retryResponse.ok) {
        const errorText = await retryResponse.text();
        throw new Error(this.formatError(retryResponse.status, errorText));
      }
      return retryResponse.json();
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(this.formatError(response.status, errorText));
    }
    return response.json();
  }

  async delete(path: string): Promise<void> {
    const tenant = this.tenantManager.getActiveTenant();
    const token = await this.auth.getToken(tenant);
    const csrfToken = await this.getCsrfToken();
    const url = `${tenant.apiUrl}${path}`;

    const response = await fetch(url, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
        "X-CSRF-Token": csrfToken,
      },
      signal: AbortSignal.timeout(30_000),
    });

    if (response.status === 403) {
      // Invalidate cached token and retry once
      this.csrfTokens.delete(tenant.clientId);
      const newCsrfToken = await this.fetchCsrfToken();
      const retryResponse = await fetch(url, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "X-CSRF-Token": newCsrfToken,
        },
        signal: AbortSignal.timeout(30_000),
      });
      if (!retryResponse.ok) {
        const errorText = await retryResponse.text();
        throw new Error(this.formatError(retryResponse.status, errorText));
      }
      return;
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(this.formatError(response.status, errorText));
    }
  }

  async put(path: string, body: Record<string, unknown>): Promise<void> {
    const tenant = this.tenantManager.getActiveTenant();
    const token = await this.auth.getToken(tenant);
    const csrfToken = await this.getCsrfToken();
    const url = `${tenant.apiUrl}${path}`;

    const response = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-CSRF-Token": csrfToken,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });

    if (response.status === 403) {
      this.csrfTokens.delete(tenant.clientId);
      const newCsrfToken = await this.fetchCsrfToken();
      const retryResponse = await fetch(url, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-CSRF-Token": newCsrfToken,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30_000),
      });
      if (!retryResponse.ok) {
        const errorText = await retryResponse.text();
        throw new Error(this.formatError(retryResponse.status, errorText));
      }
      return;
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(this.formatError(response.status, errorText));
    }
  }

  async getCollection<T = Record<string, unknown>>(path: string, params?: ODataParams): Promise<T[]> {
    const json = await this.request(path, params);
    return json.d.results as T[];
  }

  async getEntity<T = Record<string, unknown>>(path: string, params?: ODataParams): Promise<T> {
    const json = await this.request(path, params);
    return json.d as T;
  }

  async getValue(path: string): Promise<string> {
    const tenant = this.tenantManager.getActiveTenant();
    const token = await this.auth.getToken(tenant);
    const url = `${tenant.apiUrl}${path}`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "*/*" },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(this.formatError(response.status, errorText));
    }
    return response.text();
  }

  private buildUrl(base: string, path: string, params?: ODataParams): string {
    let url = `${base}${path}`;
    if (params) {
      const parts: string[] = [];
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) {
          parts.push(`${key}=${encodeURIComponent(String(value))}`);
        }
      }
      if (parts.length > 0) url += `?${parts.join("&")}`;
    }
    return url;
  }

  private async request(path: string, params?: ODataParams): Promise<any> {
    const tenant = this.tenantManager.getActiveTenant();
    const token = await this.auth.getToken(tenant);
    const url = this.buildUrl(tenant.apiUrl, path, params);
    const response = await fetch(url, {
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(this.formatError(response.status, errorText));
    }
    return response.json();
  }

  private formatError(status: number, body: string): string {
    try {
      const parsed = JSON.parse(body);
      if (parsed?.error?.message?.value) return `OData error (${status}): ${parsed.error.message.value}`;
    } catch { /* Not JSON */ }
    return `OData error (${status}): ${body}`;
  }
}

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
}

export class ODataClient {
  constructor(private auth: Auth, private tenantManager: TenantManager) {}

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
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
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

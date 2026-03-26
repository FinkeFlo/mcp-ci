import type { Tenant } from "./types.js";

interface CachedToken {
  accessToken: string;
  expiresAt: number;
}

const TOKEN_BUFFER_MS = 60_000; // Refresh 60s before expiry

export class Auth {
  private cache = new Map<string, CachedToken>();

  async getToken(tenant: Tenant): Promise<string> {
    const cacheKey = tenant.clientId;
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() < cached.expiresAt) {
      return cached.accessToken;
    }

    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: tenant.clientId,
      client_secret: tenant.clientSecret,
    });

    const response = await fetch(tenant.oauthUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Auth failed for tenant ${tenant.name} (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as { access_token: string; expires_in: number };

    this.cache.set(cacheKey, {
      accessToken: data.access_token,
      expiresAt: Date.now() + data.expires_in * 1000 - TOKEN_BUFFER_MS,
    });

    return data.access_token;
  }
}

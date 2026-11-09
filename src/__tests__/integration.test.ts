import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { TenantManager } from "../core/tenant-manager.js";
import { Auth } from "../core/auth.js";
import { ODataClient } from "../core/odata-client.js";
import { parseTenantConfig, resolveConfigPath } from "../core/config.js";
import type { TenantConfig } from "../core/types.js";
import type { MessageProcessingLog } from "../modules/monitoring/types.js";
import { buildListMessagesParams } from "../modules/monitoring/queries.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const configPath = (() => {
  try {
    return resolveConfigPath(process.env, resolve(__dirname, "../.."), existsSync).path;
  } catch {
    return undefined;
  }
})();

// Talks to the real default tenant when a config exists (GET only).
describe.skipIf(!configPath)("Integration: SAP CPI Dev Tenant", () => {
  let odataClient: ODataClient;

  it("can authenticate and list messages", async () => {
    const config: TenantConfig = parseTenantConfig(readFileSync(configPath!, "utf-8"), configPath);
    const tenantManager = new TenantManager(config);
    const auth = new Auth();
    odataClient = new ODataClient(auth, tenantManager);

    const params = buildListMessagesParams({ top: 5 });
    const messages = await odataClient.getCollection<MessageProcessingLog>(
      "/api/v1/MessageProcessingLogs",
      params
    );

    expect(Array.isArray(messages)).toBe(true);
    if (messages.length > 0) {
      expect(messages[0]).toHaveProperty("MessageGuid");
      expect(messages[0]).toHaveProperty("Status");
      expect(messages[0]).toHaveProperty("IntegrationFlowName");
    }
  }, 30_000);
});

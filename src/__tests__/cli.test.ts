import { describe, it, expect } from "vitest";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { parseTenantConfig } from "../core/config.js";

const root = new URL("../../", import.meta.url);
const fixture = new URL("fixtures/tenants.fixture.jsonc", import.meta.url);

describe("stdio CLI (local users change nothing)", () => {
  it("starts from MCP_CI_CONFIG, serves read-only tools and prints the same banner", async () => {
    const child = spawn(process.execPath, ["--import", "tsx", "src/index.ts"], {
      cwd: root,
      env: { ...process.env, MCP_CI_CONFIG: fixture.pathname },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    const send = (message: object) => child.stdin.write(JSON.stringify(message) + "\n");

    send({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "0" } },
    });
    send({ jsonrpc: "2.0", method: "notifications/initialized" });
    send({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });

    const deadline = Date.now() + 15_000;
    const responses = () =>
      stdout.split("\n").filter(Boolean).map((line) => JSON.parse(line) as any);
    while (Date.now() < deadline && !responses().some((r) => r.id === 2)) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    child.kill();

    const byId = new Map(responses().map((r) => [r.id, r]));
    expect(byId.get(1).result.serverInfo.name).toBe("mcp-ci");
    const names: string[] = byId.get(2).result.tools.map((tool: { name: string }) => tool.name);
    expect(names).toContain("get_package");
    expect(names).not.toContain("create_package");
    expect(stderr).toContain("mcp-ci server running on stdio (tenant: fixture, read-only)");
  }, 30_000);

  it("still loads the shipped example config and the fixture unchanged", () => {
    const example = new URL("config/tenants.example.jsonc", root);
    expect(Object.keys(parseTenantConfig(readFileSync(example, "utf-8")).tenants)).toEqual(["dev"]);
    expect(parseTenantConfig(readFileSync(fixture, "utf-8")).defaultTenant).toBe("fixture");
  });
});

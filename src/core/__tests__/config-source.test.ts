import { describe, it, expect, afterEach, afterAll } from "vitest";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createFileConfigSource } from "../config-source.js";
import { parseTenantConfig } from "../config.js";
import { LOCAL_PRINCIPAL } from "../extension-points.js";

const fixturePath = new URL("../../__tests__/fixtures/tenants.fixture.jsonc", import.meta.url);
const fixtureText = readFileSync(fixturePath, "utf-8");

describe("createFileConfigSource", () => {
  const dir = mkdtempSync(join(tmpdir(), "mcp-ci-config-source-"));
  const savedEnv = process.env.MCP_CI_CONFIG;
  afterEach(() => {
    if (savedEnv === undefined) delete process.env.MCP_CI_CONFIG;
    else process.env.MCP_CI_CONFIG = savedEnv;
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("resolves the same config as parseTenantConfig for an explicit path", async () => {
    const path = join(dir, "explicit.jsonc");
    writeFileSync(path, fixtureText);
    const config = await createFileConfigSource({ path }).resolve(LOCAL_PRINCIPAL);
    expect(config).toEqual(parseTenantConfig(fixtureText));
  });

  it("uses MCP_CI_CONFIG when no path is given", async () => {
    const path = join(dir, "from-env.jsonc");
    writeFileSync(path, fixtureText);
    process.env.MCP_CI_CONFIG = path;
    const config = await createFileConfigSource().resolve(LOCAL_PRINCIPAL);
    expect(Object.keys(config.tenants)).toEqual(["fixture"]);
  });

  it("rejects when the file does not exist", async () => {
    await expect(
      createFileConfigSource({ path: join(dir, "missing.jsonc") }).resolve(LOCAL_PRINCIPAL)
    ).rejects.toThrow();
  });

  it("fails closed on invalid content with the parser's message", async () => {
    const path = join(dir, "invalid.jsonc");
    writeFileSync(path, `{ "tenants": { "a": { "enabled": false } }, "defaultTenant": "a" }`);
    await expect(createFileConfigSource({ path }).resolve(LOCAL_PRINCIPAL)).rejects.toThrow(
      "no enabled tenant"
    );
  });
});

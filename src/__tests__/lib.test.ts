import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as lib from "../lib.js";

const root = new URL("../../", import.meta.url);
const pkg = JSON.parse(readFileSync(new URL("package.json", root), "utf-8"));

describe("library entry", () => {
  it("exports exactly the documented values", () => {
    expect(Object.keys(lib).sort()).toEqual(
      [
        "ClientCredentialsTokenProvider",
        "CsrfTokenCache",
        "LOCAL_PRINCIPAL",
        "NoTenantsError",
        "ODataClient",
        "TenantManager",
        "assertPrincipal",
        "buildServer",
        "createFileConfigSource",
        "createSessionFactory",
        "loadTenantConfig",
        "parseTenantConfig",
        "startHttpServer",
        "validateTenantConfig",
      ].sort()
    );
  });

  it("imports without starting a server or reading a config", () => {
    const result = spawnSync(
      process.execPath,
      ["--import", "tsx", "-e", "await import('./src/lib.ts')"],
      {
        cwd: root,
        env: { ...process.env, MCP_CI_CONFIG: "/nonexistent/mcp-ci-test/tenants.jsonc" },
        encoding: "utf-8",
        timeout: 10_000,
        input: "",
      }
    );
    expect(result.error).toBeUndefined();
    expect(result.stderr).toBe("");
    expect(result.stdout).toBe("");
    expect(result.status).toBe(0);
  });
});

describe("package.json", () => {
  it("points the library entry at dist/lib.js and keeps the CLI as bin", () => {
    expect(pkg.main).toBe("dist/lib.js");
    expect(pkg.exports["."].default).toBe("./dist/lib.js");
    expect(pkg.exports["."].types).toBe("./dist/lib.d.ts");
    expect(pkg.bin["mcp-ci"]).toBe("dist/index.js");
    expect(pkg.mcpServer.command).toBe("npx");
  });
});

describe("build output", () => {
  it("emits the type declarations that package.json promises", () => {
    const outDir = mkdtempSync(join(tmpdir(), "mcp-ci-build-"));
    try {
      const result = spawnSync("npx", ["tsc", "-p", "tsconfig.build.json", "--outDir", outDir], {
        cwd: root,
        encoding: "utf-8",
        timeout: 120_000,
      });
      expect(result.status, result.stdout + result.stderr).toBe(0);
      expect(existsSync(join(outDir, "lib.js"))).toBe(true);
      expect(existsSync(join(outDir, "lib.d.ts"))).toBe(true);
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  }, 150_000);
});

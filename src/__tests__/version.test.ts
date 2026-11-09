import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { SERVER_VERSION } from "../version.js";

describe("SERVER_VERSION", () => {
  it("is the version from package.json", () => {
    const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf-8"));
    expect(SERVER_VERSION).toBe(pkg.version);
  });
});

describe("readVersion", () => {
  it("falls back to unknown when package.json is missing, broken or has no version", async () => {
    const { mkdtempSync, writeFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const { tmpdir } = await import("node:os");
    const { pathToFileURL } = await import("node:url");
    const { readVersion } = await import("../version.js");
    const dir = mkdtempSync(join(tmpdir(), "version-"));
    writeFileSync(join(dir, "broken.json"), "{");
    writeFileSync(join(dir, "noversion.json"), "{}");
    writeFileSync(join(dir, "ok.json"), '{"version":"9.9.9"}');
    expect(readVersion(pathToFileURL(join(dir, "missing.json")))).toBe("unknown");
    expect(readVersion(pathToFileURL(join(dir, "broken.json")))).toBe("unknown");
    expect(readVersion(pathToFileURL(join(dir, "noversion.json")))).toBe("unknown");
    expect(readVersion(pathToFileURL(join(dir, "ok.json")))).toBe("9.9.9");
  });
});

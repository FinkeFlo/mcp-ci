import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { SERVER_VERSION } from "../version.js";

describe("SERVER_VERSION", () => {
  it("is the version from package.json", () => {
    const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf-8"));
    expect(SERVER_VERSION).toBe(pkg.version);
  });
});

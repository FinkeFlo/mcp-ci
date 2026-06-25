import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parseSpecs } from "../specs.js";

const SAMPLE = `swagger: '2.0'
paths:
  /Things:
    get:
      summary: List things
      tags: [Things]
    post:
      summary: Create thing
      tags: [Things]
  /Things('{Id}'):
    get:
      summary: Get a thing
      tags: [Things]
`;

describe("parseSpecs", () => {
  let dir: string;
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "specs-"));
    writeFileSync(join(dir, "sample.yaml"), SAMPLE);
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("extracts one operation per method per path", () => {
    const ops = parseSpecs(dir);
    expect(ops).toHaveLength(3);
  });

  it("uppercases method, keeps path verbatim, and tags the spec file", () => {
    const ops = parseSpecs(dir);
    expect(ops).toContainEqual({
      spec: "sample.yaml",
      method: "POST",
      path: "/Things",
      tag: "Things",
      summary: "Create thing",
    });
    expect(ops).toContainEqual({
      spec: "sample.yaml",
      method: "GET",
      path: "/Things('{Id}')",
      tag: "Things",
      summary: "Get a thing",
    });
  });
});

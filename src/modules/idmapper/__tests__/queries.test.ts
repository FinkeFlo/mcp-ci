import { describe, it, expect } from "vitest";
import { buildFromIdPath, buildToIdPath } from "../queries.js";

describe("buildFromIdPath", () => {
  it("builds path for sourceId lookup", () => {
    expect(buildFromIdPath("SRC-123")).toBe(
      "/api/v1/IdMapFromIds('SRC-123')/ToIds"
    );
  });

  it("escapes single quotes in sourceId", () => {
    expect(buildFromIdPath("src'id")).toBe(
      "/api/v1/IdMapFromIds('src''id')/ToIds"
    );
  });
});

describe("buildToIdPath", () => {
  it("builds path for targetId lookup", () => {
    expect(buildToIdPath("TGT-456")).toBe(
      "/api/v1/IdMapToIds('TGT-456')/FromId2s"
    );
  });

  it("escapes single quotes in targetId", () => {
    expect(buildToIdPath("tgt'id")).toBe(
      "/api/v1/IdMapToIds('tgt''id')/FromId2s"
    );
  });
});

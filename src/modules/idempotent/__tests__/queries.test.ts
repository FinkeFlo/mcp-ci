import { describe, it, expect } from "vitest";
import { toHex, buildEntriesPath, buildEntryPath } from "../queries.js";

describe("toHex", () => {
  it("converts ASCII string to hex", () => {
    expect(toHex("SAP")).toBe("534150");
  });

  it("converts an empty string to empty hex", () => {
    expect(toHex("")).toBe("");
  });

  it("converts a string with spaces", () => {
    expect(toHex("AB")).toBe("4142");
  });
});

describe("buildEntriesPath", () => {
  it("builds path with encoded id query param", () => {
    expect(buildEntriesPath("my-entry")).toBe(
      "/api/v1/GenericIdempotentRepositoryEntries?id=my-entry"
    );
  });

  it("encodes special characters in id", () => {
    expect(buildEntriesPath("entry/with spaces")).toBe(
      "/api/v1/GenericIdempotentRepositoryEntries?id=entry%2Fwith%20spaces"
    );
  });
});

describe("buildEntryPath", () => {
  it("hex-encodes all four components", () => {
    const path = buildEntryPath("SAP", "MySource", "MyEntry", "MyComponent");
    expect(path).toBe(
      `/api/v1/GenericIdempotentRepositoryEntries(HexVendor='${toHex("SAP")}',HexSource='${toHex("MySource")}',HexEntry='${toHex("MyEntry")}',HexComponent='${toHex("MyComponent")}')`
    );
  });

  it("hex-encodes vendor 'SAP' as '534150'", () => {
    const path = buildEntryPath("SAP", "src", "ent", "comp");
    expect(path).toContain("HexVendor='534150'");
  });
});

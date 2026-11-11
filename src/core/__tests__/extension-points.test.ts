import { describe, it, expect } from "vitest";
import { LOCAL_PRINCIPAL, assertPrincipal } from "../extension-points.js";

describe("LOCAL_PRINCIPAL", () => {
  it("is the fixed local principal and cannot be changed", () => {
    expect(LOCAL_PRINCIPAL.subject).toBe("local");
    expect(LOCAL_PRINCIPAL.roles).toEqual([]);
    expect(LOCAL_PRINCIPAL.claims).toEqual({});
    expect(Object.isFrozen(LOCAL_PRINCIPAL)).toBe(true);
    expect(Object.isFrozen(LOCAL_PRINCIPAL.roles)).toBe(true);
    expect(Object.isFrozen(LOCAL_PRINCIPAL.claims)).toBe(true);
  });
});

describe("assertPrincipal", () => {
  it.each([
    ["undefined", undefined],
    ["null", null],
    ["a string", "alice"],
    ["an empty object", {}],
    ["an empty subject", { subject: "", roles: [], claims: {} }],
    ["a non-string subject", { subject: 1, roles: [], claims: {} }],
    ["roles that are not a list", { subject: "a", roles: "admin", claims: {} }],
    ["roles with a non-string", { subject: "a", roles: [1], claims: {} }],
    ["claims that are a list", { subject: "a", roles: [], claims: [] }],
    ["missing claims", { subject: "a", roles: [] }],
  ])("rejects %s", (_name, value) => {
    expect(() => assertPrincipal(value)).toThrow("Invalid principal");
  });

  it("accepts a valid principal and returns a copy", () => {
    const input = { subject: "alice", roles: ["reader"], claims: { tid: "t1" } };
    const result = assertPrincipal(input);
    expect(result).toEqual(input);
    expect(result).not.toBe(input);
    expect(result.roles).not.toBe(input.roles);
    expect(result.claims).not.toBe(input.claims);
  });
});

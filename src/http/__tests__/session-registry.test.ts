import { describe, it, expect } from "vitest";
import { SessionRegistry, type RegisteredSession } from "../session-registry.js";

const entry = (id: string, subject = "alice"): RegisteredSession =>
  ({ id, subject, server: {}, transport: {} }) as unknown as RegisteredSession;

describe("SessionRegistry", () => {
  it("stops reserving at the limit, counting reservations that are not committed yet", () => {
    const registry = new SessionRegistry(2);
    const first = registry.reserve();
    const second = registry.reserve();
    expect(first && second).toBeTruthy();
    expect(registry.reserve()).toBeUndefined();
    first!.commit(entry("a"));
    expect(registry.size).toBe(1);
    expect(registry.reserve()).toBeUndefined();
    second!.release();
    expect(registry.reserve()).toBeDefined();
  });

  it("frees the slot when a session is removed, and release after commit is a no-op", () => {
    const registry = new SessionRegistry(1);
    const reservation = registry.reserve()!;
    reservation.commit(entry("a"));
    reservation.release();
    expect(registry.reserve()).toBeUndefined();
    registry.remove("a");
    expect(registry.reserve()).toBeDefined();
  });

  it("returns and removes only sessions idle longer than the timeout", () => {
    let now = 1_000;
    const registry = new SessionRegistry(5, () => now);
    registry.reserve()!.commit(entry("old"));
    now = 5_000;
    registry.reserve()!.commit(entry("young"));
    now = 6_500;
    expect(registry.sweep(2_000).map((session) => session.id)).toEqual(["old"]);
    expect(registry.get("old")).toBeUndefined();
    expect(registry.get("young")).toBeDefined();
  });

  it("never sweeps a session with an open request, and starts the idle clock when it closes", () => {
    let now = 0;
    const registry = new SessionRegistry(5, () => now);
    registry.reserve()!.commit(entry("a"));
    const session = registry.get("a")!;
    registry.beginRequest(session);
    now = 100_000;
    expect(registry.sweep(1_000)).toEqual([]);
    registry.endRequest(session);
    now = 100_500;
    expect(registry.sweep(1_000)).toEqual([]);
    now = 101_500;
    expect(registry.sweep(1_000).map((s) => s.id)).toEqual(["a"]);
  });
});

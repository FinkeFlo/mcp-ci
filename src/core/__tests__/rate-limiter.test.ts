import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  RateLimiter,
  LocalThrottleError,
  backoffDelay,
  DEFAULT_RATE_LIMIT_CONFIG,
  type RateLimitConfig,
} from "../rate-limiter.js";

function cfg(overrides: Partial<RateLimitConfig> = {}): RateLimitConfig {
  return { ...DEFAULT_RATE_LIMIT_CONFIG, ...overrides };
}

/** Drains pending microtasks and zero-delay timers under fake timers. */
async function flush(): Promise<void> {
  await vi.advanceTimersByTimeAsync(0);
}

describe("RateLimiter — rate shaping (GCRA)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("applies the safety factor to the effective rate", () => {
    const rl = new RateLimiter(cfg({ safetyFactor: 0.5 }));
    expect(rl.effectiveRate("mpl")).toBe(50); // 100 * 0.5
    expect(rl.effectiveRate("numberRange")).toBe(2.5); // 5 * 0.5
  });

  it("lets the first request through immediately", async () => {
    const rl = new RateLimiter(cfg({ safetyFactor: 1 }));
    let done = false;
    rl.acquire("s", "default").then(() => (done = true));
    await flush();
    expect(done).toBe(true);
  });

  it("spaces consecutive requests by the emission interval with burst=1", async () => {
    // default = 5/s, safetyFactor 1 -> 200ms spacing.
    const rl = new RateLimiter(cfg({ safetyFactor: 1, burst: 1 }));
    await rl.acquire("s", "default"); // first: immediate

    let secondDone = false;
    rl.acquire("s", "default").then(() => (secondDone = true));

    await vi.advanceTimersByTimeAsync(199);
    expect(secondDone).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(secondDone).toBe(true);
  });

  it("allows a burst up to the configured burst capacity", async () => {
    // burst=3 -> first 3 requests are immediate, 4th is delayed.
    const rl = new RateLimiter(cfg({ safetyFactor: 1, burst: 3 }));
    const results: boolean[] = [false, false, false, false];
    for (let i = 0; i < 4; i++) {
      rl.acquire("s", "default").then(() => (results[i] = true));
    }
    await flush();
    await flush();
    expect(results.slice(0, 3)).toEqual([true, true, true]);
    expect(results[3]).toBe(false);
    await vi.advanceTimersByTimeAsync(200);
    expect(results[3]).toBe(true);
  });

  it("keeps separate rate-subjects independent (no cross-leak)", async () => {
    const rl = new RateLimiter(cfg({ safetyFactor: 1, burst: 1 }));
    await rl.acquire("subjectA", "default");

    let bDone = false;
    rl.acquire("subjectB", "default").then(() => (bDone = true));
    await flush();
    expect(bDone).toBe(true); // B not throttled by A's usage
  });

  it("keeps separate categories on the same subject independent for rate", async () => {
    const rl = new RateLimiter(cfg({ safetyFactor: 1, burst: 1 }));
    await rl.acquire("s", "default");

    let mplDone = false;
    rl.acquire("s", "mpl").then(() => (mplDone = true));
    await flush();
    expect(mplDone).toBe(true);
  });
});

describe("RateLimiter — concurrency semaphore", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("caps in-flight requests and transfers slots on release", async () => {
    // High burst so rate shaping never delays; isolate concurrency.
    const rl = new RateLimiter(cfg({ safetyFactor: 1, burst: 1000, maxConcurrent: 2 }));
    const rel1 = await rl.acquire("s", "mpl");
    await rl.acquire("s", "mpl");

    let thirdDone = false;
    rl.acquire("s", "mpl").then(() => (thirdDone = true));
    await flush();
    expect(thirdDone).toBe(false); // both slots busy

    rel1(); // free a slot
    await flush();
    expect(thirdDone).toBe(true);
  });

  it("enforces the concurrency cap tenant-wide across categories", async () => {
    const rl = new RateLimiter(cfg({ safetyFactor: 1, burst: 1000, maxConcurrent: 2 }));
    await rl.acquire("s", "mpl");
    await rl.acquire("s", "designtime");

    let thirdDone = false;
    rl.acquire("s", "security").then(() => (thirdDone = true)); // different category, same subject
    await flush();
    expect(thirdDone).toBe(false);
  });

  it("never exceeds maxConcurrent under a parallel fan-out", async () => {
    const max = 3;
    const rl = new RateLimiter(cfg({ safetyFactor: 1, burst: 1000, maxConcurrent: max }));
    let inFlight = 0;
    let peak = 0;

    const work = Array.from({ length: 20 }, () =>
      rl.acquire("s", "mpl").then((release) => {
        inFlight++;
        peak = Math.max(peak, inFlight);
        // release on the next tick to let others queue
        setTimeout(() => {
          inFlight--;
          release();
        }, 5);
      }),
    );

    await vi.advanceTimersByTimeAsync(500);
    await Promise.all(work);
    expect(peak).toBeLessThanOrEqual(max);
  });
});

describe("RateLimiter — bounded queue (fail-fast)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("throws LocalThrottleError when the rate wait exceeds maxQueueWaitMs", async () => {
    // default 5/s -> 200ms spacing; budget 100ms.
    const rl = new RateLimiter(cfg({ safetyFactor: 1, burst: 1, maxQueueWaitMs: 100 }));
    await rl.acquire("s", "default");
    await expect(rl.acquire("s", "default")).rejects.toBeInstanceOf(LocalThrottleError);
  });

  it("throws LocalThrottleError when the concurrency wait exceeds maxQueueWaitMs", async () => {
    const rl = new RateLimiter(
      cfg({ safetyFactor: 1, burst: 1000, maxConcurrent: 1, maxQueueWaitMs: 100 }),
    );
    await rl.acquire("s", "mpl"); // occupies the only slot, never released

    const rejected = rl.acquire("s", "mpl");
    const assertion = expect(rejected).rejects.toBeInstanceOf(LocalThrottleError);
    await vi.advanceTimersByTimeAsync(100);
    await assertion;
  });
});

describe("RateLimiter — disabled passthrough", () => {
  it("returns immediately with a no-op release and never waits", async () => {
    const rl = new RateLimiter(cfg({ enabled: false, maxConcurrent: 1 }));
    // Far more than maxConcurrent, no releases — must not block.
    const releases = await Promise.all(
      Array.from({ length: 5 }, () => rl.acquire("s", "numberRange")),
    );
    expect(releases).toHaveLength(5);
    releases.forEach((r) => expect(typeof r).toBe("function"));
  });
});

describe("backoffDelay", () => {
  const c = { backoffBaseMs: 500, backoffCapMs: 20_000 };

  it("honours Retry-After delta-seconds", () => {
    expect(backoffDelay("1", 0, c)).toBe(1000);
    expect(backoffDelay("5", 3, c)).toBe(5000);
  });

  it("caps a large Retry-After at backoffCapMs", () => {
    expect(backoffDelay("999", 0, c)).toBe(20_000);
  });

  it("honours a future HTTP-date Retry-After", () => {
    const now = () => 1_000_000;
    const future = new Date(1_000_000 + 3000).toUTCString();
    // toUTCString truncates to whole seconds, so allow rounding.
    const delay = backoffDelay(future, 0, c, Math.random, now);
    expect(delay).toBeGreaterThanOrEqual(2000);
    expect(delay).toBeLessThanOrEqual(3000);
  });

  it("clamps a past HTTP-date Retry-After to 0", () => {
    const now = () => 5_000_000;
    const past = new Date(1_000_000).toUTCString();
    expect(backoffDelay(past, 0, c, Math.random, now)).toBe(0);
  });

  it("falls back to exponential backoff with full jitter for a missing header", () => {
    // random=0.5, attempt=2 -> ceiling=min(20000, 500*4)=2000 -> floor(0.5*2000)=1000
    expect(backoffDelay(null, 2, c, () => 0.5)).toBe(1000);
  });

  it("falls back to exponential backoff for a malformed header", () => {
    expect(backoffDelay("not-a-date", 0, c, () => 0)).toBe(0);
    expect(backoffDelay("not-a-date", 1, c, () => 0.999999)).toBeLessThanOrEqual(1000);
  });

  it("caps exponential backoff at backoffCapMs", () => {
    expect(backoffDelay(null, 20, c, () => 0.9999999)).toBeLessThanOrEqual(20_000);
  });
});

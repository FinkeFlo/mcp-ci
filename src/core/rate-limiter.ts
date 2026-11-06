/**
 * Client-side rate-limiting gatekeeper for SAP Cloud Integration.
 *
 * Two independent mechanisms, keyed per rate-subject (`${apiUrl}|${clientId}`):
 *   1. Rate shaping via GCRA (Generic Cell Rate Algorithm) per (subject, category).
 *      The refill rate enforces SAP's documented requests/second limit; the
 *      `burst` capacity is intentionally tiny (default 1 = no bunching), because
 *      SAP measures a strict per-second rate and a full token bucket would let a
 *      burst breach low-rate categories.
 *   2. A concurrency semaphore per subject (tenant/user-wide across categories)
 *      capping in-flight requests, to tame `Promise.all` fan-out spikes.
 *
 * Both waits are bounded by `maxQueueWaitMs`; on overflow `acquire()` fails fast
 * with `LocalThrottleError` instead of growing an unbounded queue.
 */

export type RateCategory =
  | "mpl"
  | "runtime"
  | "designtime"
  | "security"
  | "numberRange"
  | "partnerDirectory"
  | "csrf"
  | "default";

/** SAP per-user rate limits in requests/second. */
export const CATEGORY_RATE_PER_SECOND: Record<RateCategory, number> = {
  mpl: 100,
  runtime: 50,
  partnerDirectory: 25,
  designtime: 10,
  security: 10,
  numberRange: 5,
  csrf: 5,
  default: 5,
};

export interface RateLimitConfig {
  enabled: boolean;
  /** Fraction of the documented limit we actually target (headroom). */
  safetyFactor: number;
  /** Burst capacity per category. 1 = strict spacing, no bunching. */
  burst: number;
  /** Max in-flight requests per rate-subject, across all categories. */
  maxConcurrent: number;
  /** 429 retries before ODataClient surfaces a RateLimitError. */
  maxRetries: number;
  /** Upper bound on how long acquire() may wait before failing fast. */
  maxQueueWaitMs: number;
  backoffBaseMs: number;
  backoffCapMs: number;
}

export const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
  enabled: true,
  safetyFactor: 0.8,
  burst: 1,
  maxConcurrent: 10,
  maxRetries: 4,
  maxQueueWaitMs: 30_000,
  backoffBaseMs: 500,
  backoffCapMs: 20_000,
};

/** Thrown when a request would have to wait longer than `maxQueueWaitMs`. */
export class LocalThrottleError extends Error {
  constructor(public readonly category: RateCategory, public readonly waitedMs: number) {
    super(
      `Local rate-limit queue full for category '${category}': would wait ${Math.round(
        waitedMs,
      )}ms (exceeds maxQueueWaitMs). Reduce concurrency or retry later.`,
    );
    this.name = "LocalThrottleError";
  }
}

interface Semaphore {
  active: number;
  queue: Array<{ resolve: () => void; reject: (err: Error) => void; timer: ReturnType<typeof setTimeout> }>;
}

export class RateLimiter {
  /** GCRA "theoretical arrival time" per `${subject}|${category}`. */
  private readonly tatByKey = new Map<string, number>();
  /** Concurrency semaphore per rate-subject. */
  private readonly semaphores = new Map<string, Semaphore>();

  constructor(
    private readonly cfg: RateLimitConfig = DEFAULT_RATE_LIMIT_CONFIG,
    private readonly now: () => number = () => Date.now(),
  ) {}

  /** Effective per-second rate for a category after applying the safety factor. */
  effectiveRate(category: RateCategory): number {
    const base = CATEGORY_RATE_PER_SECOND[category] ?? CATEGORY_RATE_PER_SECOND.default;
    return Math.max(base * this.cfg.safetyFactor, 0.001);
  }

  /**
   * Acquire permission to send one request. Resolves once both the rate slot and
   * a concurrency slot are available. Returns a `release()` that MUST be called
   * (in a `finally`) to free the concurrency slot. The rate slot is never
   * returned — it is consumed against the per-second rate.
   *
   * @throws {LocalThrottleError} if the combined wait would exceed maxQueueWaitMs.
   */
  async acquire(subject: string, category: RateCategory): Promise<() => void> {
    if (!this.cfg.enabled) {
      return () => {};
    }

    const start = this.now();

    // (1) Rate shaping — reserve synchronously to avoid races between concurrent
    // acquires (single-threaded: no await before the map is updated).
    const rateWaitMs = this.reserveRateSlot(subject, category);
    if (rateWaitMs > 0) {
      await sleep(rateWaitMs);
    }

    // (2) Concurrency semaphore, bounded by the remaining wait budget.
    const remaining = this.cfg.maxQueueWaitMs - (this.now() - start);
    await this.acquireSlot(subject, category, remaining);

    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.releaseSlot(subject);
    };
  }

  private reserveRateSlot(subject: string, category: RateCategory): number {
    const emissionIntervalMs = 1000 / this.effectiveRate(category);
    const toleranceMs = Math.max(0, this.cfg.burst - 1) * emissionIntervalMs;
    const now = this.now();
    const key = `${subject}|${category}`;

    const tat = this.tatByKey.get(key) ?? now;
    const effectiveTat = Math.max(tat, now);
    const waitMs = Math.max(0, effectiveTat - toleranceMs - now);

    if (waitMs > this.cfg.maxQueueWaitMs) {
      throw new LocalThrottleError(category, waitMs);
    }

    this.tatByKey.set(key, effectiveTat + emissionIntervalMs);
    return waitMs;
  }

  private acquireSlot(subject: string, category: RateCategory, budgetMs: number): Promise<void> {
    const sem = this.getSemaphore(subject);
    if (sem.active < this.cfg.maxConcurrent) {
      sem.active++;
      return Promise.resolve();
    }
    if (budgetMs <= 0) {
      return Promise.reject(new LocalThrottleError(category, this.cfg.maxQueueWaitMs));
    }
    return new Promise<void>((resolve, reject) => {
      const waiter = {
        resolve,
        reject,
        timer: setTimeout(() => {
          const idx = sem.queue.indexOf(waiter);
          if (idx >= 0) sem.queue.splice(idx, 1);
          reject(new LocalThrottleError(category, budgetMs));
        }, budgetMs),
      };
      sem.queue.push(waiter);
    });
  }

  private releaseSlot(subject: string): void {
    const sem = this.getSemaphore(subject);
    const next = sem.queue.shift();
    if (next) {
      // Transfer the slot: `active` stays the same, the waiter proceeds.
      clearTimeout(next.timer);
      next.resolve();
    } else {
      sem.active = Math.max(0, sem.active - 1);
    }
  }

  private getSemaphore(subject: string): Semaphore {
    let sem = this.semaphores.get(subject);
    if (!sem) {
      sem = { active: 0, queue: [] };
      this.semaphores.set(subject, sem);
    }
    return sem;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Computes the delay before a 429 retry. Honours `Retry-After` (delta-seconds or
 * HTTP-date), clamping negative/invalid/far-future values; otherwise falls back
 * to exponential backoff with full jitter. Always capped by `backoffCapMs`.
 */
export function backoffDelay(
  retryAfter: string | null,
  attempt: number,
  cfg: Pick<RateLimitConfig, "backoffBaseMs" | "backoffCapMs">,
  random: () => number = Math.random,
  now: () => number = () => Date.now(),
): number {
  const parsed = parseRetryAfter(retryAfter, now);
  if (parsed !== null) {
    return Math.min(cfg.backoffCapMs, parsed);
  }
  const exp = cfg.backoffBaseMs * 2 ** attempt;
  const ceiling = Math.min(cfg.backoffCapMs, exp);
  return Math.floor(random() * ceiling);
}

function parseRetryAfter(value: string | null, now: () => number): number | null {
  if (!value) return null;
  const trimmed = value.trim();

  // Delta-seconds form.
  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed) * 1000;
  }

  // HTTP-date form.
  const dateMs = Date.parse(trimmed);
  if (!Number.isNaN(dateMs)) {
    const delta = dateMs - now();
    return delta > 0 ? delta : 0;
  }

  return null;
}

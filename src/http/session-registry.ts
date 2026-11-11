import type { McpServer, WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/server";

/** Roles as an order-independent string, to tell whether a person's roles changed. */
export function rolesKey(roles: string[]): string {
  return JSON.stringify([...roles].sort());
}

/** One live HTTP session, bound to the subject that created it. */
export interface RegisteredSession {
  id: string;
  subject: string;
  /** The principal's roles when the session started, as one comparable string (see `rolesKey`). */
  roles: string;
  /** The `configKey` of the config the session was built from. */
  configKey: string;
  server: McpServer;
  transport: WebStandardStreamableHTTPServerTransport;
  /** Requests and streams currently open on this session. */
  open: number;
  lastActive: number;
}

export interface Reservation {
  /** Turns the reservation into a live session. Later `release` calls do nothing. */
  commit(session: Omit<RegisteredSession, "open" | "lastActive">): RegisteredSession;
  /** Gives the slot back; does nothing after `commit` or a second call. */
  release(): void;
}

/**
 * Bookkeeping for sessions. A slot is reserved before the session exists, so
 * concurrent `initialize` requests cannot overshoot the limit.
 */
export class SessionRegistry {
  private sessions = new Map<string, RegisteredSession>();
  private pending = 0;

  constructor(
    private maxSessions: number,
    private now: () => number = Date.now
  ) {}

  get size(): number {
    return this.sessions.size;
  }

  reserve(): Reservation | undefined {
    if (this.sessions.size + this.pending >= this.maxSessions) return undefined;
    this.pending++;
    let settled = false;
    return {
      commit: (session) => {
        const entry: RegisteredSession = { ...session, open: 0, lastActive: this.now() };
        if (!settled) {
          settled = true;
          this.pending--;
        }
        this.sessions.set(entry.id, entry);
        return entry;
      },
      release: () => {
        if (settled) return;
        settled = true;
        this.pending--;
      },
    };
  }

  get(id: string): RegisteredSession | undefined {
    return this.sessions.get(id);
  }

  remove(id: string): void {
    this.sessions.delete(id);
  }

  all(): RegisteredSession[] {
    return [...this.sessions.values()];
  }

  beginRequest(session: RegisteredSession): void {
    session.open++;
  }

  endRequest(session: RegisteredSession): void {
    session.open = Math.max(0, session.open - 1);
    session.lastActive = this.now();
  }

  /** Removes and returns sessions with nothing open that were idle longer than `idleTimeoutMs`. */
  sweep(idleTimeoutMs: number): RegisteredSession[] {
    const cutoff = this.now() - idleTimeoutMs;
    const idle = this.all().filter((session) => session.open === 0 && session.lastActive < cutoff);
    for (const session of idle) this.sessions.delete(session.id);
    return idle;
  }
}

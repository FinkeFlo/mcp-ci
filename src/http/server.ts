import { randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { WebStandardStreamableHTTPServerTransport, isInitializeRequest } from "@modelcontextprotocol/server";
import { NoTenantsError } from "../core/config.js";
import { assertPrincipal, type Authenticator, type Principal, type ServerOptions } from "../core/extension-points.js";
import { createSessionFactory, type Session } from "../core/session-factory.js";
import { readBody, sendWebResponse, toWebRequest } from "./node-bridge.js";
import { SessionRegistry, rolesKey, type RegisteredSession } from "./session-registry.js";

const MAX_BODY_BYTES = 4 * 1024 * 1024;

export interface HttpServerOptions extends ServerOptions {
  /** Required. Decides who a request belongs to; there is no anonymous mode. */
  authenticator: Authenticator;
  /** Default `127.0.0.1`. */
  host?: string;
  /** Default 3000; 0 picks a free port. */
  port?: number;
  /** Default `/mcp`. */
  path?: string;
  /** Default 100. */
  maxSessions?: number;
  /** Default 30 minutes. */
  idleTimeoutMs?: number;
}

export interface RunningHttpServer {
  /** The MCP endpoint, for example `http://127.0.0.1:3000/mcp`. */
  url: string;
  port: number;
  sessionCount(): number;
  close(): Promise<void>;
}

function reply(
  res: ServerResponse,
  status: number,
  message: string,
  headers: Record<string, string> = {}
): void {
  if (res.headersSent) return;
  res.writeHead(status, { "Content-Type": "application/json", ...headers });
  res.end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32000, message }, id: null }));
}

/**
 * Serves MCP over Streamable HTTP with one server per session. Every request
 * is authenticated, a session belongs to the subject that created it, and the
 * answers never carry the reason an inner step failed.
 */
export async function startHttpServer(options: HttpServerOptions): Promise<RunningHttpServer> {
  if (typeof options?.authenticator?.authenticate !== "function") {
    throw new Error("startHttpServer requires an authenticator");
  }
  if (typeof options.configSource?.resolve !== "function") {
    throw new Error("startHttpServer requires a configSource");
  }
  const host = options.host ?? "127.0.0.1";
  const path = options.path ?? "/mcp";
  const maxSessions = options.maxSessions ?? 100;
  const idleTimeoutMs = options.idleTimeoutMs ?? 30 * 60_000;
  for (const [name, value] of [["maxSessions", maxSessions], ["idleTimeoutMs", idleTimeoutMs]] as const) {
    if (!Number.isInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer`);
  }

  const { authenticator } = options;
  const factory = createSessionFactory(options);
  const registry = new SessionRegistry(maxSessions);

  /** Keeps the session non-idle while a request or its stream is open. */
  const track = (session: RegisteredSession, res: ServerResponse) => {
    // A client that is already gone would never fire `close` again.
    if (res.destroyed) return;
    registry.beginRequest(session);
    res.once("close", () => registry.endRequest(session));
  };

  const authenticate = async (req: IncomingMessage, origin: string): Promise<Principal | undefined> => {
    try {
      return assertPrincipal(await authenticator.authenticate(toWebRequest(req, origin)));
    } catch {
      return undefined;
    }
  };

  async function existingSession(
    session: RegisteredSession,
    req: IncomingMessage,
    res: ServerResponse,
    origin: string
  ): Promise<void> {
    // Tracked before the body is read, so a slow upload keeps the session from idling out.
    track(session, res);
    let body: string | undefined;
    if (req.method === "POST") {
      body = await readBody(req, MAX_BODY_BYTES);
      if (body === undefined) return reply(res, 413, "Request too large");
    }
    const request = toWebRequest(req, origin, body, { stripCredentials: true });
    await sendWebResponse(res, await session.transport.handleRequest(request));
  }

  async function newSession(
    principal: Principal,
    req: IncomingMessage,
    res: ServerResponse,
    origin: string
  ): Promise<void> {
    if (req.method !== "POST") return reply(res, 405, "Method not allowed", { Allow: "POST" });
    const body = await readBody(req, MAX_BODY_BYTES);
    if (body === undefined) return reply(res, 413, "Request too large");
    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch {
      return reply(res, 400, "Bad request");
    }
    if (!isInitializeRequest(parsed)) return reply(res, 400, "Bad request: session id required");

    const reservation = registry.reserve();
    if (!reservation) return reply(res, 503, "Too many sessions");
    let session: Session | undefined;
    try {
      try {
        session = await factory.createSession(principal);
      } catch (error) {
        return reply(res, error instanceof NoTenantsError ? 403 : 503, error instanceof NoTenantsError ? "Forbidden" : "Service unavailable");
      }
      const transport: WebStandardStreamableHTTPServerTransport = new WebStandardStreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (id) => {
          reservation.commit({
            id,
            subject: principal.subject,
            roles: rolesKey(principal.roles),
            server: session!.server,
            transport,
          });
        },
      });
      transport.onclose = () => {
        if (transport.sessionId) registry.remove(transport.sessionId);
      };
      await session.server.connect(transport);
      const response = await transport.handleRequest(
        toWebRequest(req, origin, body, { stripCredentials: true }),
        { parsedBody: parsed }
      );
      const created = transport.sessionId ? registry.get(transport.sessionId) : undefined;
      // Nobody got the session id when the client left meanwhile, so nobody could end it.
      if (!created || res.destroyed) {
        await session.server.close().catch(() => undefined);
        return;
      }
      track(created, res);
      await sendWebResponse(res, response);
    } catch (error) {
      await session?.server.close().catch(() => undefined);
      throw error;
    } finally {
      reservation.release();
    }
  }

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    let origin: string;
    let pathname: string;
    try {
      origin = `http://${req.headers.host ?? "localhost"}`;
      pathname = new URL(req.url ?? "/", origin).pathname;
    } catch {
      return reply(res, 400, "Bad request");
    }
    if (pathname !== path) return reply(res, 404, "Not found");

    const principal = await authenticate(req, origin);
    if (!principal) return reply(res, 401, "Unauthorized", { "WWW-Authenticate": "Bearer" });

    const header = req.headers["mcp-session-id"];
    if (Array.isArray(header)) return reply(res, 400, "Bad request");
    if (header === undefined) return newSession(principal, req, res, origin);
    const session = registry.get(header);
    if (!session) return reply(res, 404, "Session not found");
    if (session.subject !== principal.subject) return reply(res, 403, "Forbidden");
    if (session.roles !== rolesKey(principal.roles)) {
      // The session still holds the config of the old roles. End it, so the client starts a new one.
      await session.server.close().catch(() => undefined);
      return reply(res, 403, "Forbidden");
    }
    return existingSession(session, req, res, origin);
  }

  const httpServer = createServer((req, res) => {
    handle(req, res).catch(() => {
      if (res.headersSent) res.destroy();
      else reply(res, 500, "Internal error");
    });
  });
  await new Promise<void>((resolve, reject) => {
    httpServer.once("error", reject);
    httpServer.listen(options.port ?? 3000, host, () => {
      httpServer.off("error", reject);
      resolve();
    });
  });

  const closeServer = (session: RegisteredSession) => session.server.close().catch(() => undefined);
  const timer = setInterval(
    () => void Promise.all(registry.sweep(idleTimeoutMs).map(closeServer)),
    Math.min(Math.max(Math.floor(idleTimeoutMs / 2), 10), 60_000)
  );
  timer.unref();

  const port = (httpServer.address() as AddressInfo).port;
  return {
    url: `http://${host.includes(":") ? `[${host}]` : host}:${port}${path}`,
    port,
    sessionCount: () => registry.size,
    async close() {
      clearInterval(timer);
      await Promise.all(registry.all().map(closeServer));
      await new Promise<void>((resolve) => {
        httpServer.close(() => resolve());
        httpServer.closeAllConnections();
      });
    },
  };
}

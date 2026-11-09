import type { IncomingMessage, ServerResponse } from "node:http";

/**
 * Builds a web `Request` from a Node request. `body` is the already read body
 * text; without it the request has no body (what the authenticator gets).
 */
export function toWebRequest(req: IncomingMessage, origin: string, body?: string): Request {
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) for (const entry of value) headers.append(name, entry);
    else headers.set(name, value);
  }
  const method = req.method ?? "GET";
  const withBody = body !== undefined && method !== "GET" && method !== "HEAD";
  if (withBody) {
    // The body was re-encoded from text, so the original framing no longer applies.
    headers.delete("content-length");
    headers.delete("transfer-encoding");
  }
  return new Request(new URL(req.url ?? "/", origin), {
    method,
    headers,
    body: withBody ? body : undefined,
  });
}

/** Reads a request body as text; `undefined` when it is larger than `maxBytes`. */
export async function readBody(req: IncomingMessage, maxBytes: number): Promise<string | undefined> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > maxBytes) return undefined;
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString("utf-8");
}

/** Streams a web `Response` to a Node response, cancelling it when the client goes away. */
export async function sendWebResponse(res: ServerResponse, response: Response): Promise<void> {
  const headers: Record<string, string> = {};
  response.headers.forEach((value, name) => {
    headers[name] = value;
  });
  res.writeHead(response.status, headers);
  res.flushHeaders();
  if (!response.body) {
    res.end();
    return;
  }
  const reader = response.body.getReader();
  const cancel = () => void reader.cancel().catch(() => undefined);
  res.on("close", cancel);
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done || res.destroyed) break;
      if (!res.write(value)) {
        await new Promise<void>((resolve) => {
          res.once("drain", resolve);
          res.once("close", resolve);
        });
      }
    }
  } finally {
    res.off("close", cancel);
    res.end();
  }
}

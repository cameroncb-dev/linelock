import type { IncomingMessage, ServerResponse } from "node:http";
import type { LiveEngine } from "./live-engine";

/**
 * The JSON API, kept out of server.ts so it can be exercised by tests and so
 * the error contract lives next to the Rails one it has to match
 * (backend/app/controllers/api/entries_controller.rb).
 *
 * Errors are always `{ ok: false, error }` plus `drifted` on a stale line; the
 * HTTP status carries the code, exactly as the Rails backend does it.
 */

export const MAX_BODY_BYTES = 8_192;

/** Point at which an oversized body stops being drained politely. */
const HARD_BODY_LIMIT = 1_000_000;

export const INVALID_JSON_ERROR = "Body must be valid JSON.";
export const BODY_TOO_LARGE_ERROR = `Body must be under ${MAX_BODY_BYTES} bytes.`;

type BodyResult =
  | { ok: true; value: unknown }
  | { ok: false; status: number; error: string };

export function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(body));
}

export function sendError(res: ServerResponse, status: number, error: string): void {
  sendJson(res, status, { ok: false, error });
}

export async function readJsonBody(req: IncomingMessage): Promise<BodyResult> {
  const chunks: Buffer[] = [];
  let size = 0;
  let tooLarge = false;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) {
      // Drain rather than destroy, so the client still reads the 413.
      tooLarge = true;
      if (size > HARD_BODY_LIMIT) {
        req.destroy();
        break;
      }
      continue;
    }
    chunks.push(chunk as Buffer);
  }
  if (tooLarge) return { ok: false, status: 413, error: BODY_TOO_LARGE_ERROR };
  if (!chunks.length) return { ok: true, value: {} };
  try {
    return { ok: true, value: JSON.parse(Buffer.concat(chunks).toString("utf8")) };
  } catch {
    return { ok: false, status: 400, error: INVALID_JSON_ERROR };
  }
}

/** Returns true when the request was an API route and a response was sent. */
export async function handleApiRequest(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
  engine: LiveEngine,
): Promise<boolean> {
  if (req.method === "GET" && pathname === "/api/health") {
    sendJson(res, 200, engine.health());
    return true;
  }

  if (req.method === "GET" && pathname === "/api/props") {
    sendJson(res, 200, engine.snapshot());
    return true;
  }

  const one = pathname.match(/^\/api\/props\/([^/]+)$/);
  if (req.method === "GET" && one) {
    const prop = engine.getProp(decodeURIComponent(one[1]));
    if (!prop) {
      sendError(res, 404, "Prop not found.");
      return true;
    }
    sendJson(res, 200, prop);
    return true;
  }

  if (req.method === "GET" && pathname === "/api/entries") {
    sendJson(res, 200, { entries: engine.listEntries() });
    return true;
  }

  if (req.method === "POST" && pathname === "/api/entries") {
    const body = await readJsonBody(req);
    if (!body.ok) {
      sendError(res, body.status, body.error);
      return true;
    }
    const payload = (body.value ?? {}) as { legs?: unknown };
    const result = engine.submitEntry({
      legs: Array.isArray(payload.legs) ? payload.legs : [],
    });
    if (!result.ok) {
      const { status, ...rest } = result;
      sendJson(res, status, rest);
      return true;
    }
    sendJson(res, 201, result);
    return true;
  }

  return false;
}

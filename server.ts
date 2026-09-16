import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { parse } from "node:url";
import next from "next";
import { WebSocket, WebSocketServer } from "ws";
import { MAX_WS_CLIENTS } from "./src/lib/types";
import { liveEngine } from "./src/server/live-engine";

const port = Number(process.env.PORT ?? 43147);
const hostname = process.env.HOST ?? "0.0.0.0";
const dev = process.env.NODE_ENV !== "production";
const MAX_BUFFERED = 32_768;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(body));
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 8_192) throw new Error("payload too large");
    chunks.push(chunk as Buffer);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function main() {
  await app.prepare();
  liveEngine.start();

  const server = createServer((req, res) => {
    const url = parse(req.url ?? "/", true);
    const pathname = url.pathname ?? "/";

    void (async () => {
      try {
        if (req.method === "GET" && pathname === "/api/health") {
          json(res, 200, liveEngine.health());
          return;
        }
        if (req.method === "GET" && pathname === "/api/props") {
          json(res, 200, liveEngine.snapshot());
          return;
        }
        const one = pathname.match(/^\/api\/props\/([^/]+)$/);
        if (req.method === "GET" && one) {
          const prop = liveEngine.getProp(decodeURIComponent(one[1]));
          if (!prop) {
            json(res, 404, { error: "Prop not found" });
            return;
          }
          json(res, 200, prop);
          return;
        }
        if (req.method === "GET" && pathname === "/api/entries") {
          json(res, 200, { entries: liveEngine.listEntries() });
          return;
        }
        if (req.method === "POST" && pathname === "/api/entries") {
          const body = (await readJson(req)) as { legs?: unknown };
          const result = liveEngine.submitEntry({
            legs: Array.isArray(body.legs) ? body.legs : [],
          });
          if (!result.ok) {
            json(res, result.status, result);
            return;
          }
          json(res, 201, result);
          return;
        }

        await handle(req, res, url);
      } catch (error) {
        console.error(error);
        if (!res.headersSent) json(res, 500, { error: "Internal error" });
      }
    })();
  });

  const wss = new WebSocketServer({
    noServer: true,
    perMessageDeflate: false,
    maxPayload: 16_384,
    clientTracking: true,
  });

  server.on("upgrade", (req, socket, head) => {
    const pathname = parse(req.url ?? "/", true).pathname ?? "/";
    if (pathname !== "/ws") {
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  });

  wss.on("connection", (socket) => {
    if (wss.clients.size > MAX_WS_CLIENTS) {
      socket.close(1013, "capacity");
      return;
    }
    socket.send(JSON.stringify({ type: "hello", ...liveEngine.snapshot() }));
    socket.on("message", () => {
      /* server-push feed; ignore client payloads to keep memory bounded */
    });
  });

  liveEngine.onTick((batch) => {
    const payload = JSON.stringify(batch);
    for (const client of wss.clients) {
      if (client.readyState !== WebSocket.OPEN) continue;
      if (client.bufferedAmount > MAX_BUFFERED) continue;
      client.send(payload);
    }
  });

  server.listen(port, hostname, () => {
    console.log(`LineLock listening on http://${hostname}:${port}`);
  });
}

void main();

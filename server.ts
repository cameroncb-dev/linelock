import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { parse } from "node:url";
import next from "next";
import { WebSocket, WebSocketServer } from "ws";
import { MAX_WS_CLIENTS } from "./src/lib/types";
import { handleApiRequest, sendError } from "./src/server/api";
import { liveEngine } from "./src/server/live-engine";

const port = Number(process.env.PORT ?? 43147);
const hostname = process.env.HOST ?? "0.0.0.0";
const dev = process.env.NODE_ENV !== "production";
const MAX_BUFFERED = 32_768;

/** `npm run dev:rails-ui` points the UI at Rails, so this process must not also simulate. */
const servesOwnFeed = !process.env.NEXT_PUBLIC_API_ORIGIN;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

async function main() {
  await app.prepare();
  if (servesOwnFeed) liveEngine.start();

  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const url = parse(req.url ?? "/", true);
    const pathname = url.pathname ?? "/";

    void (async () => {
      try {
        if (await handleApiRequest(req, res, pathname, liveEngine)) return;
        await handle(req, res, url);
      } catch (error) {
        console.error(error);
        if (!res.headersSent) sendError(res, 500, "Something went wrong on the server.");
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
    if (pathname === "/ws") {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req);
      });
      return;
    }
    // Next adds its own upgrade listener for HMR the first time it renders a
    // page, so /_next/* is already spoken for. Everything else belongs to
    // nobody, and returning without closing leaks a socket per retry.
    if (pathname.startsWith("/_next/")) return;
    socket.destroy();
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
    const feed = servesOwnFeed ? "own feed" : `UI only, API at ${process.env.NEXT_PUBLIC_API_ORIGIN}`;
    console.log(`LineLock listening on http://${hostname}:${port} (${feed})`);
  });
}

void main();

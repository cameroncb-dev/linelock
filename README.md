# LineLock

Simulated **more/less player-prop board** with live line movement. Built as a PrizePicks-shaped intern portfolio slice: React board, JSON API, WebSocket feed, bounded live-data memory. Not a sportsbook. No real money. No PrizePicks scraping.

## Why this maps to PrizePicks

PrizePicks interns work React / React Native on the board and slip, and Rails on APIs. An intern who interviewed there called out TypeScript, WebSockets, a component library, state management, and memory limits on live data. LineLock is that checklist on one product:

- More/Less cards + 2–6 pick slip
- HTTP snapshot + POST that rejects drifted lines
- Mock WS ticks for lines and live stats
- Ring buffer of 48 ticks per prop (server and client)
- Slow sockets are skipped (`bufferedAmount` cap) instead of queuing forever

**Rails is not in slice 1.** This environment has Node 22 and no Ruby. A dual-process Rails API would have delayed a running demo. The UI talks to a stable JSON/WS contract a Rails app could implement later.

## Run

```bash
npm install
npm test
npm run dev
```

Open [http://127.0.0.1:43147](http://127.0.0.1:43147).

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Feed + memory stats |
| GET | `/api/props` | Full slate + tick history |
| GET | `/api/props/:id` | One prop |
| GET | `/api/entries` | Last demo slips |
| POST | `/api/entries` | Lock a 2–6 pick slip |
| WS | `/ws` | Line / live-stat batches |

`PORT` defaults to **43147**. Custom Node server (`server.ts`) serves Next.js, the API, and WebSockets on that port.

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind · shadcn/ui · Zustand · Node HTTP + `ws`

A Rails API + Action Cable backend is the next slice. The UI already talks to a typed JSON/WS contract so that swap does not require board changes.

## Engineering decisions

- **WebSocket feed:** `server.ts` serves Next.js, REST, and `/ws` on one port. The mock engine ticks ~every 900ms with line nudges and live-stat bumps. Slow clients are skipped when `bufferedAmount` is high instead of buffering forever. Cap of 32 sockets.
- **Bounded tick history:** `RingBuffer` keeps at most 48 ticks per prop on the server and the client. Oldest samples drop. Memory stats are on `GET /api/health` and in the header.
- **Zustand + stale lines:** Board state (props, slip, connection) lives in Zustand. Locking a pick stores `lockedLine`. If the feed moves the line, the slip flags drift and `POST /api/entries` returns 409 until you re-lock.
- **HTTP API:** `GET /api/health`, `GET /api/props`, `GET /api/props/:id`, `GET|POST /api/entries`. Submit validates 2–6 unique legs and current lines.

## Demo data

NBA/NFL names with **invented** lines and a random-walk feed. Statuses include live, upcoming, and final so empty/filter states are real.

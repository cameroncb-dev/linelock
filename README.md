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

Next.js 16 (App Router) · TypeScript · Tailwind · shadcn/ui · Zustand · `ws`

## Demo data

NBA/NFL names with **invented** lines and a random-walk feed. Statuses include live, upcoming, and final so empty/filter states are real.

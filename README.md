# LineLock

Simulated **more/less player-prop board** with live line movement. PrizePicks-shaped intern portfolio: React board, JSON API, live feed, bounded tick memory. Not a sportsbook. No real money. No PrizePicks scraping.

## Why this maps to PrizePicks

PrizePicks interns work React / React Native on the board and slip, and **Ruby on Rails** on APIs. LineLock ships both:

- More/Less cards + 2–6 pick slip
- HTTP snapshot + POST that rejects drifted lines
- Live ticks for lines and stats
- Ring buffer of 48 ticks per prop (Node and Rails)
- Slow sockets skipped instead of unbounded queues

**Two backends, one contract.** The UI does not change. `NEXT_PUBLIC_API_ORIGIN` selects Node (default, same origin) or Rails.

| | Node | Rails |
| --- | --- | --- |
| Why it exists | Fast first demo: Next.js + HTTP + `/ws` in one process | PrizePicks-shaped backend: Rails API + Action Cable |
| Port | **43147** | **43148** |
| Live transport | raw WebSocket `/ws` | Action Cable `/cable` **and** the same raw `/ws` JSON as Node |

## Run — Node (default)

```bash
npm install
npm test
npm run dev
```

Open [http://127.0.0.1:43147](http://127.0.0.1:43147).

## Run — Rails API + React board

Needs Ruby 3.3+ (`rbenv install 3.3.6`).

```bash
cd backend
bundle install
bin/rails db:prepare
bundle exec rspec
PORT=43148 bin/rails server -b 0.0.0.0
```

In another terminal:

```bash
npm install
NEXT_PUBLIC_API_ORIGIN=http://127.0.0.1:43148 npm run dev
```

## Contract

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Feed + memory stats |
| GET | `/api/props` | Slate + tick history |
| GET | `/api/props/:id` | One prop |
| GET | `/api/entries` | Last demo slips |
| POST | `/api/entries` | Lock a 2–6 pick slip |
| WS | `/ws` | `{ type: "hello" }` then `{ type: "batch" }` |
| WS | `/cable` | Action Cable `FeedChannel` (Rails only) |

## Engineering decisions

- **WebSocket / Action Cable:** Node custom server multiplexes Next + REST + `/ws`. Rails broadcasts ticks through Action Cable (`linelock_feed`) and mirrors the Node JSON on `/ws` so the React client can swap origins with one env var.
- **Bounded tick history:** `RingBuffer` / `RingBuffer` in Ruby keeps at most 48 ticks per prop. Oldest samples drop.
- **Zustand + stale lines:** Locking a pick stores `lockedLine`. Drift shows on the slip; `POST /api/entries` returns 409 until re-lock.
- **HTTP API:** Same paths on both servers. Rails health includes `"backend": "rails"`.

## Stack

Next.js 16 · TypeScript · Tailwind · shadcn/ui · Zustand · Node (`server.ts` + `ws`) · Rails 8 API · Action Cable · RSpec

## Demo data

NBA/NFL names with **invented** lines and a random-walk feed.

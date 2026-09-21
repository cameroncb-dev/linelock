# LineLock Rails API

API-only Rails 8 app that implements the **same JSON + `/ws` contract** as the Node server, plus Action Cable at `/cable`.

Ruby 3.3.6. No Redis — Action Cable uses the `async` adapter. No database: the slate, the tick history and the demo entries all live in `LiveEngine`, a singleton behind a mutex, so there are no models and no migrations.

```bash
cd backend
bundle install
bundle exec rspec
PORT=43148 bin/rails server -b 0.0.0.0
```

`bin/ci` runs setup, RuboCop, the specs, bundler-audit and Brakeman.

Health: `GET http://127.0.0.1:43148/api/health` (includes `"backend":"rails"`).

Point the Next.js board at this process:

```bash
npm run dev:rails-ui
# or: NEXT_PUBLIC_API_ORIGIN=http://127.0.0.1:43148 npm run dev
```

| File | What it does |
| --- | --- |
| `app/services/sim.rb` | Clock-driven stat model, mirroring `src/lib/sim.ts` |
| `app/services/slate.rb` | The demo games and props |
| `app/services/live_engine.rb` | Tick loop, snapshots, entries |
| `app/services/entry_validator.rb` | Slip rules, mirroring `src/lib/entries.ts` |
| `app/services/ring_buffer.rb` | Bounded per-prop tick history |
| `app/middleware/line_lock_socket.rb` | Raw `/ws` frames, byte-identical to Node's |

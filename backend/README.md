# LineLock Rails API

API-only Rails 8 app that implements the **same JSON + `/ws` contract** as the Node server, plus Action Cable at `/cable`.

Ruby 3.3.6 (rbenv). No Redis — Action Cable uses the `async` adapter.

```bash
cd backend
bundle install
bin/rails db:prepare
bundle exec rspec
PORT=43148 bin/rails server -b 0.0.0.0
```

Health: `GET http://127.0.0.1:43148/api/health` (includes `"backend":"rails"`).

Point the Next.js board at this process:

```bash
NEXT_PUBLIC_API_ORIGIN=http://127.0.0.1:43148 npm run dev
# or: npm run dev:rails-ui
```

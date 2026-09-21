import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { parse } from "node:url";
import { handleApiRequest } from "./api";
import { LiveEngine } from "./live-engine";

type ErrorCase = {
  name: string;
  body?: string;
  bodyBytes?: number;
  status: number;
  error: string;
};

const contract = JSON.parse(
  readFileSync(
    fileURLToPath(new URL("../../contract/error-contract.json", import.meta.url)),
    "utf8",
  ),
) as { path: string; cases: ErrorCase[] };

const engine = new LiveEngine();
let server: Server;
let origin = "";

before(async () => {
  server = createServer((req, res) => {
    const pathname = parse(req.url ?? "/", true).pathname ?? "/";
    void handleApiRequest(req, res, pathname, engine).then((handled) => {
      if (!handled) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: "Not found." }));
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address && typeof address === "object") origin = `http://127.0.0.1:${address.port}`;
});

after(() => {
  server.close();
});

async function post(body: string) {
  const res = await fetch(`${origin}/api/entries`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  return { status: res.status, json: await res.json() };
}

test("GET /api/health names the backend", async () => {
  const res = await fetch(`${origin}/api/health`);
  const json = await res.json();
  assert.equal(res.status, 200);
  assert.equal(json.product, "LineLock");
  assert.equal(json.backend, "node");
  assert.equal(json.memory.maxTicksPerProp, 48);
});

test("GET /api/props returns the slate with bounded history", async () => {
  const res = await fetch(`${origin}/api/props`);
  const json = await res.json();
  assert.equal(res.status, 200);
  assert.equal(json.props.length, 16);
  const luka = json.props.find((prop: { id: string }) => prop.id === "nba-luka-pts");
  assert.equal(luka.player, "Luka Dončić");
  assert.ok(luka.history.length >= 1 && luka.history.length <= 48);
});

test("GET /api/props/:id 404s an unknown id", async () => {
  const res = await fetch(`${origin}/api/props/nope`);
  assert.equal(res.status, 404);
  assert.deepEqual(await res.json(), { ok: false, error: "Prop not found." });
});

test("POST /api/entries locks a slip at the posted lines", async () => {
  const snapshot = await (await fetch(`${origin}/api/props`)).json();
  const [first, second] = snapshot.props.filter(
    (prop: { gameStatus: string }) => prop.gameStatus !== "final",
  );
  const { status, json } = await post(
    JSON.stringify({
      legs: [
        { propId: first.id, side: "more", lockedLine: first.line },
        { propId: second.id, side: "less", lockedLine: second.line },
      ],
    }),
  );
  assert.equal(status, 201);
  assert.equal(json.ok, true);
  assert.equal(json.entry.multiplier, 3);
});

test("POST /api/entries rejects a line that moved", async () => {
  const snapshot = await (await fetch(`${origin}/api/props`)).json();
  const [first, second] = snapshot.props.filter(
    (prop: { gameStatus: string }) => prop.gameStatus !== "final",
  );
  const { status, json } = await post(
    JSON.stringify({
      legs: [
        { propId: first.id, side: "more", lockedLine: first.line },
        { propId: second.id, side: "less", lockedLine: second.line + 1.5 },
      ],
    }),
  );
  assert.equal(status, 409);
  assert.deepEqual(json.drifted, [second.id]);
  assert.equal(json.status, undefined, "the HTTP status should not be repeated in the body");
});

for (const entry of contract.cases) {
  test(`error contract: ${entry.name}`, async () => {
    const body =
      entry.body ??
      JSON.stringify({ legs: [], filler: "x".repeat(entry.bodyBytes ?? 0) });
    const { status, json } = await post(body);
    assert.equal(status, entry.status);
    assert.deepEqual(json, { ok: false, error: entry.error });
  });
}

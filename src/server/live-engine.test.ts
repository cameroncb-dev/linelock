import assert from "node:assert/strict";
import { test } from "node:test";
import { MAX_TICKS_PER_PROP } from "../lib/types";
import { MAX_PROJECTION_FACTOR, STAT_PROFILES, lineBound } from "../lib/sim";
import { LiveEngine } from "./live-engine";

function pctOfLine(liveStat: number, line: number) {
  return (liveStat / line) * 100;
}

test("hydrates a slate of live, scheduled and final props", () => {
  const engine = new LiveEngine();
  const snapshot = engine.snapshot();
  assert.equal(snapshot.props.length, 16);

  const statuses = new Set(snapshot.props.map((prop) => prop.gameStatus));
  assert.ok(statuses.has("live"));
  assert.ok(statuses.has("scheduled"));
  assert.ok(statuses.has("final"));

  for (const prop of snapshot.props) {
    if (prop.gameStatus === "scheduled") {
      assert.equal(prop.liveStat, null, `${prop.id} should not have a stat yet`);
    } else {
      assert.ok(prop.liveStat != null, `${prop.id} should have a stat`);
      assert.ok(
        pctOfLine(prop.liveStat, prop.line) <= MAX_PROJECTION_FACTOR * 100,
        `${prop.id} opened at ${prop.liveStat} against a line of ${prop.line}`,
      );
    }
  }
});

test("props in the same game share one clock", () => {
  const engine = new LiveEngine();
  for (let i = 0; i < 50; i++) engine.tick();
  const props = engine.snapshot().props.filter((prop) => prop.gameId === "nba-lal-bos");
  const clocks = new Set(props.map((prop) => prop.clock));
  assert.equal(props.length, 3);
  assert.equal(clocks.size, 1, `clocks drifted apart: ${[...clocks].join(", ")}`);
});

test("stats stay realistic for a whole slate of games", () => {
  const engine = new LiveEngine();

  // Long enough for every game to tip off and run out the clock.
  for (let i = 0; i < 2_100; i++) {
    engine.tick();
    for (const prop of engine.snapshot().props) {
      assert.equal(
        prop.line,
        Math.round(prop.line * 2) / 2,
        `${prop.id} posted an off-grid line of ${prop.line}`,
      );
      if (prop.liveStat == null) continue;
      const ceiling = STAT_PROFILES[prop.stat].ceiling;
      assert.ok(
        prop.liveStat <= ceiling,
        `${prop.player} reached ${prop.liveStat} ${prop.stat} (record is ${ceiling})`,
      );
      // The runaway bug this replaces had Durant at 58 threes on a 2.5 line.
      const plausible =
        (prop.openingLine + lineBound(prop.openingLine)) * MAX_PROJECTION_FACTOR + 0.5;
      assert.ok(
        prop.liveStat <= plausible,
        `${prop.player} reached ${prop.liveStat} on a line that opened at ${prop.openingLine}`,
      );
    }
  }
});

test("the board is not already decided three minutes in", () => {
  const engine = new LiveEngine();
  // ~3 minutes of wall clock at a 900ms tick.
  for (let i = 0; i < 200; i++) engine.tick();
  const live = engine
    .snapshot()
    .props.filter((prop) => prop.gameStatus === "live" && prop.liveStat != null);
  const over = live.filter((prop) => prop.liveStat! > prop.line);
  assert.ok(live.length > 0, "expected live props");
  assert.ok(
    over.length <= live.length / 2,
    `${over.length} of ${live.length} live props had already cleared their line`,
  );
});

test("scheduled games tip off and finished games stop moving", () => {
  const engine = new LiveEngine();
  const before = engine.snapshot().props.find((prop) => prop.id === "nba-jokic-pts");
  assert.equal(before?.gameStatus, "scheduled");

  for (let i = 0; i < 150; i++) engine.tick();
  const after = engine.snapshot().props.find((prop) => prop.id === "nba-jokic-pts");
  assert.equal(after?.gameStatus, "live");
  assert.ok(after?.liveStat != null);

  const jefferson = engine.snapshot().props.find((prop) => prop.id === "nfl-jefferson-rec");
  assert.equal(jefferson?.gameStatus, "final");
  assert.equal(jefferson?.clock, "Final");
});

test("keeps tick history bounded per prop", () => {
  const engine = new LiveEngine();
  for (let i = 0; i < 200; i++) engine.tick();
  for (const prop of engine.snapshot().props) {
    assert.ok(prop.history.length <= MAX_TICKS_PER_PROP);
  }
  assert.ok(engine.snapshot().seq > 0);
});

test("reseeds the slate once every game is final", () => {
  const engine = new LiveEngine();
  for (let i = 0; i < 2_100; i++) engine.tick();
  const props = engine.snapshot().props;
  assert.ok(
    props.some((prop) => prop.gameStatus !== "final"),
    "the board froze instead of starting a fresh slate",
  );
});

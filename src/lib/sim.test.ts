import assert from "node:assert/strict";
import { test } from "node:test";
import {
  GAME_SECONDS_PER_TICK,
  MAX_PROJECTION_FACTOR,
  MIN_PROJECTION_FACTOR,
  STAT_PROFILES,
  advanceStat,
  elapsedAt,
  formatClock,
  gameProgress,
  lineBound,
  nudgeLine,
  projectFinal,
  regulationSeconds,
} from "./sim";

test("clock counts down inside the quarter it is in", () => {
  assert.equal(formatClock("NBA", elapsedAt("NBA", 2, 4, 18)), "Q2 4:18");
  assert.equal(formatClock("NFL", elapsedAt("NFL", 3, 8, 51)), "Q3 8:51");
  assert.equal(formatClock("NBA", 0), "Q1 12:00");
  assert.equal(formatClock("NBA", regulationSeconds("NBA")), "Final");
});

test("projections stay within a plausible band around the line", () => {
  for (let i = 0; i < 2_000; i++) {
    const projected = projectFinal(28.5, "points", Math.random);
    assert.ok(projected >= 28.5 * MIN_PROJECTION_FACTOR - 1);
    assert.ok(projected <= 28.5 * MAX_PROJECTION_FACTOR + 1);
  }
});

test("a projection never exceeds the best single game on record", () => {
  for (const [stat, profile] of Object.entries(STAT_PROFILES)) {
    const projected = projectFinal(
      profile.ceiling * 10,
      stat as keyof typeof STAT_PROFILES,
      () => 0.999,
    );
    assert.ok(projected <= profile.ceiling, `${stat} projected ${projected}`);
  }
});

test("a stat cannot outrun the game clock", () => {
  // Kevin Durant, 2.5 threes: the bug this replaces had him at 58 by minute 15.
  const projected = projectFinal(2.5, "threes", Math.random);
  let live = 0;
  const total = regulationSeconds("NBA");
  for (let elapsed = 0; elapsed <= total; elapsed += GAME_SECONDS_PER_TICK) {
    const progress = gameProgress("NBA", elapsed);
    live = advanceStat(live, projected, "threes", progress, Math.random);
    assert.ok(
      live <= projected,
      `threes ran past the projection: ${live} > ${projected}`,
    );
    assert.ok(
      live <= STAT_PROFILES.threes.ceiling,
      `threes cleared the record: ${live}`,
    );
  }
  assert.equal(live, projected, "the projection should land by the buzzer");
});

test("a line always stays on the half-point grid", () => {
  for (const opening of [2.5, 11.5, 28.5, 268.5]) {
    let line = opening;
    for (let i = 0; i < 300; i++) {
      line = nudgeLine(line, opening, Math.random);
      assert.equal(line, Math.round(line * 2) / 2, `off-grid line ${line}`);
      assert.ok(Math.abs(line - opening) <= lineBound(opening));
    }
  }
});

test("a stat is still short of its line at halftime", () => {
  const line = 268.5;
  const projected = projectFinal(line, "pass_yds", Math.random);
  let live = 0;
  const total = regulationSeconds("NFL");
  for (let elapsed = 0; elapsed <= total / 2; elapsed += GAME_SECONDS_PER_TICK) {
    live = advanceStat(
      live,
      projected,
      "pass_yds",
      gameProgress("NFL", elapsed),
      Math.random,
    );
  }
  const pctOfLine = (live / line) * 100;
  assert.ok(pctOfLine < 85, `halftime pace was ${pctOfLine.toFixed(0)}% of the line`);
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { validateEntry } from "./entries";
import type { Prop } from "./types";

function prop(over: Partial<Prop> = {}): Prop {
  return {
    id: "p1",
    sport: "NBA",
    player: "Demo Guard",
    team: "LL",
    opponent: "AW",
    position: "G",
    stat: "points",
    statLabel: "Pts",
    line: 24.5,
    openingLine: 24.5,
    liveStat: 8,
    gameStatus: "live",
    clock: "Q2 6:12",
    updatedAt: 1,
    ...over,
  };
}

test("rejects slips that are too short", () => {
  const result = validateEntry(
    { legs: [{ propId: "p1", side: "more", lockedLine: 24.5 }] },
    new Map([["p1", prop()]]),
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.status, 400);
});

test("flags drifted lines without accepting the entry", () => {
  const result = validateEntry(
    {
      legs: [
        { propId: "p1", side: "more", lockedLine: 24.5 },
        { propId: "p2", side: "less", lockedLine: 6.5 },
      ],
    },
    new Map([
      ["p1", prop()],
      ["p2", prop({ id: "p2", player: "Demo Big", line: 7.5 })],
    ]),
  );
  assert.equal(result.ok, false);
  if (!result.ok && result.status === 409) {
    assert.deepEqual(result.drifted, ["p2"]);
  }
});

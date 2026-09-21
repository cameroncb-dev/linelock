import assert from "node:assert/strict";
import { test } from "node:test";
import { LEG_SHAPE_ERROR, validateEntry } from "./entries";
import type { Prop, SlipLeg } from "./types";

function prop(over: Partial<Prop> = {}): Prop {
  return {
    id: "p1",
    gameId: "g1",
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

const slate = new Map([
  ["p1", prop()],
  ["p2", prop({ id: "p2", player: "Demo Big", line: 7.5 })],
]);

test("accepts a two-pick slip at the posted lines", () => {
  const result = validateEntry(
    {
      legs: [
        { propId: "p1", side: "more", lockedLine: 24.5 },
        { propId: "p2", side: "less", lockedLine: 7.5 },
      ],
    },
    slate,
  );
  assert.equal(result.ok, true);
  assert.equal(result.ok && result.multiplier, 3);
});

test("rejects slips that are too short", () => {
  const result = validateEntry(
    { legs: [{ propId: "p1", side: "more", lockedLine: 24.5 }] },
    slate,
  );
  assert.equal(result.ok, false);
  assert.equal(result.ok === false && result.status, 400);
  assert.equal(result.ok === false && result.error, "Slip needs 2–6 picks.");
});

test("flags drifted lines without accepting the entry", () => {
  const result = validateEntry(
    {
      legs: [
        { propId: "p1", side: "more", lockedLine: 24.5 },
        { propId: "p2", side: "less", lockedLine: 6.5 },
      ],
    },
    slate,
  );
  assert.equal(result.ok, false);
  assert.equal(result.ok === false && result.status, 409);
  assert.deepEqual(
    result.ok === false && result.status === 409 ? result.drifted : null,
    ["p2"],
  );
});

test("rejects legs that are not objects instead of throwing", () => {
  const result = validateEntry(
    { legs: [null, null] as unknown as SlipLeg[] },
    slate,
  );
  assert.equal(result.ok, false);
  assert.equal(result.ok === false && result.status, 400);
  assert.equal(result.ok === false && result.error, LEG_SHAPE_ERROR);
});

test("rejects a lockedLine that arrives as a string", () => {
  const result = validateEntry(
    {
      legs: [
        { propId: "p1", side: "more", lockedLine: "24.5" },
        { propId: "p2", side: "less", lockedLine: 7.5 },
      ] as unknown as SlipLeg[],
    },
    slate,
  );
  assert.equal(result.ok, false);
  assert.equal(result.ok === false && result.error, LEG_SHAPE_ERROR);
});

test("rejects a pick on a game that already finished", () => {
  const result = validateEntry(
    {
      legs: [
        { propId: "p1", side: "more", lockedLine: 24.5 },
        { propId: "p2", side: "less", lockedLine: 7.5 },
      ],
    },
    new Map([
      ["p1", prop()],
      ["p2", prop({ id: "p2", player: "Demo Big", line: 7.5, gameStatus: "final" })],
    ]),
  );
  assert.equal(result.ok, false);
  assert.equal(result.ok === false && result.status, 409);
  assert.equal(result.ok === false && result.error, "Demo Big is already final.");
});

import {
  DEMO_MULTIPLIERS,
  MAX_SLIP_LEGS,
  MIN_SLIP_LEGS,
  type EntryRequest,
  type Prop,
  type SlipLeg,
} from "./types";

export type EntryError =
  | { ok: false; status: 400; error: string }
  | { ok: false; status: 409; error: string; drifted?: string[] };

export type EntryOk = { ok: true; multiplier: number; legs: SlipLeg[] };

export function validateEntry(
  body: EntryRequest,
  propsById: Map<string, Prop>,
): EntryOk | EntryError {
  const legs = body.legs ?? [];
  if (legs.length < MIN_SLIP_LEGS || legs.length > MAX_SLIP_LEGS) {
    return {
      ok: false,
      status: 400,
      error: `Slip needs ${MIN_SLIP_LEGS}–${MAX_SLIP_LEGS} picks.`,
    };
  }

  const seen = new Set<string>();
  const drifted: string[] = [];

  for (const leg of legs) {
    if (leg.side !== "more" && leg.side !== "less") {
      return { ok: false, status: 400, error: "Each pick must be more or less." };
    }
    if (seen.has(leg.propId)) {
      return { ok: false, status: 400, error: "Duplicate player-stat on the same slip." };
    }
    seen.add(leg.propId);
    const prop = propsById.get(leg.propId);
    if (!prop) {
      return { ok: false, status: 400, error: `Unknown prop ${leg.propId}.` };
    }
    if (prop.gameStatus === "final") {
      return { ok: false, status: 409, error: `${prop.player} is already final.` };
    }
    if (prop.line !== leg.lockedLine) {
      drifted.push(prop.id);
    }
  }

  if (drifted.length) {
    return {
      ok: false,
      status: 409,
      error: "A line moved after you locked the pick. Re-lock to submit.",
      drifted,
    };
  }

  return {
    ok: true,
    multiplier: DEMO_MULTIPLIERS[legs.length] ?? 1,
    legs,
  };
}

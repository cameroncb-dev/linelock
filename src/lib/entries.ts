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

export const LEG_SHAPE_ERROR = "Each pick needs a propId, a side and a numeric lockedLine.";

function isLeg(value: unknown): value is SlipLeg {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const leg = value as Record<string, unknown>;
  return typeof leg.propId === "string" && typeof leg.lockedLine === "number";
}

/**
 * Validates a slip. Mirrored by backend/app/services/entry_validator.rb: both
 * backends must return the same status and the same error text for the same
 * body, malformed input included.
 */
export function validateEntry(
  body: EntryRequest,
  propsById: Map<string, Prop>,
): EntryOk | EntryError {
  const legs = Array.isArray(body?.legs) ? body.legs : [];
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
    if (!isLeg(leg)) {
      return { ok: false, status: 400, error: LEG_SHAPE_ERROR };
    }
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

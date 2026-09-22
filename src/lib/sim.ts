import type { GameStatus, Sport, StatType } from "./types";

/**
 * Clock-driven stat simulation, shared by the Node engine and mirrored 1:1 by
 * `backend/app/services/sim.rb`.
 *
 * Every live stat is pinned to a projected final total drawn around the prop's
 * line, and can only accumulate as fast as the simulated game clock allows. A
 * prop therefore drifts toward its line over a full game instead of clearing it
 * in the first minute, and More/Less stays genuinely uncertain.
 */

export const TICK_MS = 900;

/** Simulated game seconds added per tick: a 48-minute NBA game runs ~21 minutes. */
export const GAME_SECONDS_PER_TICK = 2;

export const QUARTERS = 4;

/** Chance per tick that a live prop's line moves half a point. */
export const LIVE_LINE_NUDGE_CHANCE = 0.08;

/** Pre-game lines move too, just far less often. */
export const PREGAME_LINE_NUDGE_CHANCE = 0.02;

/** Ticks to hold on a fully final slate before reseeding so a demo never goes dead. */
export const RESTART_AFTER_TICKS = 16;

/** Stats land within ±45% of their line often enough to keep both sides live. */
export const PROJECTION_SPREAD = 0.18;
export const MIN_PROJECTION_FACTOR = 0.55;
export const MAX_PROJECTION_FACTOR = 1.45;

/** Accumulate slightly ahead of a flat pace so totals land before the buzzer. */
export const PACE_LEAD = 1.06;

export type StatProfile = {
  /** Smallest realistic single addition: a made three is +1, a completion is a chunk of yards. */
  minStep: number;
  maxStep: number;
  /** Roughly the best single-game total on record, as a last-resort ceiling. */
  ceiling: number;
};

export const STAT_PROFILES: Record<StatType, StatProfile> = {
  points: { minStep: 1, maxStep: 3, ceiling: 70 },
  rebounds: { minStep: 1, maxStep: 1, ceiling: 30 },
  assists: { minStep: 1, maxStep: 1, ceiling: 25 },
  threes: { minStep: 1, maxStep: 1, ceiling: 14 },
  receptions: { minStep: 1, maxStep: 1, ceiling: 20 },
  pass_yds: { minStep: 4, maxStep: 24, ceiling: 550 },
  rush_yds: { minStep: 2, maxStep: 14, ceiling: 296 },
};

export function quarterSeconds(sport: Sport): number {
  return sport === "NBA" ? 12 * 60 : 15 * 60;
}

export function regulationSeconds(sport: Sport): number {
  return quarterSeconds(sport) * QUARTERS;
}

/** Simulated seconds elapsed when a game sits at `Q<quarter> <minutes>:<seconds>`. */
export function elapsedAt(
  sport: Sport,
  quarter: number,
  minutes: number,
  seconds: number,
): number {
  const remainingInQuarter = minutes * 60 + seconds;
  return quarter * quarterSeconds(sport) - remainingInQuarter;
}

export function formatClock(sport: Sport, elapsedSec: number): string {
  const regulation = regulationSeconds(sport);
  if (elapsedSec >= regulation) return "Final";
  const perQuarter = quarterSeconds(sport);
  const quarter = Math.floor(Math.max(0, elapsedSec) / perQuarter) + 1;
  const remaining = perQuarter - (Math.max(0, elapsedSec) % perQuarter);
  const minutes = Math.floor(remaining / 60);
  const seconds = Math.floor(remaining % 60);
  return `Q${quarter} ${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function clockLabel(
  sport: Sport,
  status: GameStatus,
  elapsedSec: number,
  startLabel: string,
): string {
  if (status === "scheduled") return startLabel;
  if (status === "final") return "Final";
  return formatClock(sport, elapsedSec);
}

export function gameProgress(sport: Sport, elapsedSec: number): number {
  return clamp(elapsedSec / regulationSeconds(sport), 0, 1);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Box–Muller, so projections cluster near the line instead of spreading flat. */
export function gaussian(random: () => number): number {
  const u = Math.max(random(), 1e-9);
  const v = random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** The total this player finishes the game with, drawn around the posted line. */
export function projectFinal(
  line: number,
  stat: StatType,
  random: () => number,
): number {
  const factor = clamp(
    1 + gaussian(random) * PROJECTION_SPREAD,
    MIN_PROJECTION_FACTOR,
    MAX_PROJECTION_FACTOR,
  );
  return clamp(Math.round(line * factor), 0, STAT_PROFILES[stat].ceiling);
}

/** Where a player already in progress sits when the slate is seeded. */
export function openingStat(
  projected: number,
  stat: StatType,
  progress: number,
  random: () => number,
): number {
  const jitter = 0.85 + random() * 0.3;
  return clamp(
    Math.round(projected * clamp(progress, 0, 1) * jitter),
    0,
    Math.min(projected, STAT_PROFILES[stat].ceiling),
  );
}

/**
 * One tick of accumulation. The stat may only climb toward the pace the game
 * clock allows, and can never pass its projected final, so the "% of line" bar
 * tracks the game instead of pinning at 100%.
 */
export function advanceStat(
  current: number,
  projected: number,
  stat: StatType,
  progress: number,
  random: () => number,
): number {
  const profile = STAT_PROFILES[stat];
  const pace = projected * clamp(progress * PACE_LEAD, 0, 1);
  if (pace - current < profile.minStep) return current;
  const span = profile.maxStep - profile.minStep + 1;
  const step = profile.minStep + Math.floor(random() * span);
  return Math.min(current + step, projected, profile.ceiling);
}

/** Books post half points, so every line stays on that grid. */
export function roundToHalf(value: number): number {
  return Math.round(value * 2) / 2;
}

/**
 * How far a line may wander from where it opened. Scaled to the number, so a
 * 268.5 pass-yard line can move 15 yards while a 2.5 three-pointer line cannot
 * collapse to 0.5.
 */
export function lineBound(openingLine: number): number {
  return roundToHalf(clamp(openingLine * 0.12, 1, 15));
}

/** Half-point random walk with a pull back toward the opening number. */
export function nudgeLine(
  line: number,
  openingLine: number,
  random: () => number,
): number {
  const drift = random() < 0.5 ? -0.5 : 0.5;
  const towardOpen = Math.sign(openingLine - line) * 0.5;
  const next = random() < 0.35 ? line + towardOpen : line + drift;
  const bound = lineBound(openingLine);
  return roundToHalf(clamp(next, Math.max(0.5, openingLine - bound), openingLine + bound));
}

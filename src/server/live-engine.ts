import { EventEmitter } from "node:events";
import { validateEntry } from "../lib/entries";
import { RingBuffer } from "../lib/ring-buffer";
import {
  GAME_SECONDS_PER_TICK,
  LIVE_LINE_NUDGE_CHANCE,
  PREGAME_LINE_NUDGE_CHANCE,
  RESTART_AFTER_TICKS,
  TICK_MS,
  advanceStat,
  clockLabel,
  gameProgress,
  nudgeLine,
  openingStat,
  projectFinal,
  regulationSeconds,
} from "../lib/sim";
import {
  MAX_ENTRIES,
  MAX_TICKS_PER_PROP,
  MAX_WS_CLIENTS,
  type Entry,
  type EntryRequest,
  type MemoryStats,
  type Prop,
  type Snapshot,
  type Tick,
  type WsBatch,
} from "../lib/types";
import { seedGames, seedSlate, type GameSeed } from "./slate";

type GameState = GameSeed;

export class LiveEngine extends EventEmitter {
  private games = new Map<string, GameState>();
  private props = new Map<string, Prop>();
  private history = new Map<string, RingBuffer<Tick>>();
  /** Each live prop's projected final total. Server-side only; never serialized. */
  private projections = new Map<string, number>();
  private entries: Entry[] = [];
  private seq = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private entrySeq = 0;
  private finalTicks = 0;

  constructor() {
    super();
    this.setMaxListeners(64);
    this.seedBoard();
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick(), TICK_MS);
    this.timer.unref?.();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  memory(): MemoryStats {
    let tickCount = 0;
    for (const buf of this.history.values()) tickCount += buf.length;
    return {
      maxTicksPerProp: MAX_TICKS_PER_PROP,
      propCount: this.props.size,
      tickCount,
      clientCap: MAX_WS_CLIENTS,
    };
  }

  snapshot(): Snapshot {
    const props = [...this.props.values()].map((prop) => ({
      ...prop,
      history: this.history.get(prop.id)?.toArray() ?? [],
    }));
    return {
      seq: this.seq,
      generatedAt: Date.now(),
      props,
      memory: this.memory(),
    };
  }

  getProp(id: string) {
    const prop = this.props.get(id);
    if (!prop) return null;
    return { ...prop, history: this.history.get(id)?.toArray() ?? [] };
  }

  health() {
    return {
      ok: true,
      product: "LineLock",
      backend: "node",
      feed: this.timer ? "running" : "stopped",
      seq: this.seq,
      memory: this.memory(),
    };
  }

  listEntries() {
    return this.entries.slice(-20).reverse();
  }

  submitEntry(body: EntryRequest) {
    const result = validateEntry(body, this.props);
    if (!result.ok) return result;
    this.entrySeq += 1;
    const entry: Entry = {
      id: `ent_${this.entrySeq}`,
      createdAt: Date.now(),
      legs: result.legs,
      multiplier: result.multiplier,
      status: "pending",
    };
    this.entries.push(entry);
    if (this.entries.length > MAX_ENTRIES) {
      this.entries.splice(0, this.entries.length - MAX_ENTRIES);
    }
    return { ok: true as const, entry };
  }

  onTick(listener: (batch: WsBatch) => void): void {
    this.on("batch", listener);
  }

  /** Reseeds the slate. Exposed for tests and for the end-of-slate restart. */
  seedBoard(): void {
    this.games.clear();
    this.props.clear();
    this.history.clear();
    this.projections.clear();
    this.finalTicks = 0;

    for (const game of seedGames()) this.games.set(game.id, { ...game });

    for (const seed of seedSlate()) {
      const game = this.games.get(seed.gameId);
      if (!game) continue;
      const prop: Prop = {
        ...seed,
        gameStatus: game.status,
        clock: clockLabel(game.sport, game.status, game.elapsedSec, game.startLabel),
        liveStat: null,
        updatedAt: Date.now(),
      };
      if (game.status !== "scheduled") {
        const projected = projectFinal(prop.line, prop.stat, Math.random);
        this.projections.set(prop.id, projected);
        prop.liveStat = openingStat(
          projected,
          prop.stat,
          gameProgress(game.sport, game.elapsedSec),
          Math.random,
        );
      }
      this.props.set(prop.id, prop);
      const buf = new RingBuffer<Tick>(MAX_TICKS_PER_PROP);
      buf.push({ t: prop.updatedAt, line: prop.line, liveStat: prop.liveStat });
      this.history.set(prop.id, buf);
    }
  }

  /** One simulated tick. Exposed so tests can drive the clock without waiting. */
  tick(): WsBatch | null {
    this.advanceClocks();

    const updates: WsBatch["updates"] = [];
    for (const prop of this.props.values()) {
      const game = this.games.get(prop.gameId);
      if (!game) continue;
      if (!this.advanceProp(prop, game)) continue;
      prop.updatedAt = Date.now();
      const tick: Tick = { t: prop.updatedAt, line: prop.line, liveStat: prop.liveStat };
      this.history.get(prop.id)?.push(tick);
      updates.push({ id: prop.id, prop: { ...prop }, tick });
    }

    if (this.restartIfSlateIsOver()) {
      return this.emitBatch(
        [...this.props.values()].map((prop) => ({
          id: prop.id,
          prop: { ...prop },
          tick: { t: prop.updatedAt, line: prop.line, liveStat: prop.liveStat },
        })),
      );
    }

    if (!updates.length) return null;
    return this.emitBatch(updates);
  }

  private emitBatch(updates: WsBatch["updates"]): WsBatch {
    this.seq += 1;
    const batch: WsBatch = { type: "batch", seq: this.seq, updates };
    this.emit("batch", batch);
    return batch;
  }

  private advanceClocks(): void {
    for (const game of this.games.values()) {
      if (game.status === "scheduled") {
        game.startsInSec -= GAME_SECONDS_PER_TICK;
        if (game.startsInSec <= 0) this.tipOff(game);
      } else if (game.status === "live") {
        const regulation = regulationSeconds(game.sport);
        game.elapsedSec = Math.min(regulation, game.elapsedSec + GAME_SECONDS_PER_TICK);
        if (game.elapsedSec >= regulation) game.status = "final";
      }
    }
  }

  private tipOff(game: GameState): void {
    game.status = "live";
    game.elapsedSec = 0;
    game.startsInSec = 0;
    for (const prop of this.props.values()) {
      if (prop.gameId !== game.id) continue;
      this.projections.set(prop.id, projectFinal(prop.line, prop.stat, Math.random));
      prop.liveStat = 0;
    }
  }

  /** Applies one tick to a prop. Returns whether anything a client can see changed. */
  private advanceProp(prop: Prop, game: GameState): boolean {
    if (game.status === "scheduled") {
      if (Math.random() >= PREGAME_LINE_NUDGE_CHANCE) return false;
      prop.line = nudgeLine(prop.line, prop.openingLine, Math.random);
      return true;
    }

    if (prop.gameStatus === "final") return false;

    const projected = this.projections.get(prop.id) ?? 0;
    prop.liveStat = advanceStat(
      prop.liveStat ?? 0,
      projected,
      prop.stat,
      gameProgress(game.sport, game.elapsedSec),
      Math.random,
    );

    if (game.status === "final") {
      prop.liveStat = projected;
      prop.gameStatus = "final";
      prop.clock = "Final";
      return true;
    }

    prop.gameStatus = "live";
    prop.clock = clockLabel(game.sport, game.status, game.elapsedSec, game.startLabel);
    if (Math.random() < LIVE_LINE_NUDGE_CHANCE) {
      prop.line = nudgeLine(prop.line, prop.openingLine, Math.random);
    }
    return true;
  }

  /** Once every game is final the board would freeze, so reseed after a short hold. */
  private restartIfSlateIsOver(): boolean {
    const over = [...this.games.values()].every((game) => game.status === "final");
    if (!over) {
      this.finalTicks = 0;
      return false;
    }
    this.finalTicks += 1;
    if (this.finalTicks < RESTART_AFTER_TICKS) return false;
    this.seedBoard();
    return true;
  }
}

export const liveEngine = new LiveEngine();

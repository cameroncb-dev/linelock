import { EventEmitter } from "node:events";
import { validateEntry } from "../lib/entries";
import { RingBuffer } from "../lib/ring-buffer";
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
import { seedSlate } from "./slate";

const TICK_MS = 900;

function cloneProp(prop: Prop): Prop {
  return { ...prop };
}

function stepLiveClock(clock: string): string {
  const m = clock.match(/^Q(\d) (\d+):(\d+)$/);
  if (!m) return clock;
  let q = Number(m[1]);
  let min = Number(m[2]);
  let sec = Number(m[3]) - 9;
  if (sec < 0) {
    sec += 60;
    min -= 1;
  }
  if (min < 0) {
    q += 1;
    min = 11;
    sec = 59;
  }
  if (q > 4) return "Final";
  return `Q${q} ${min}:${String(sec).padStart(2, "0")}`;
}

function nudgeLine(prop: Prop): number {
  const delta = Math.random() < 0.5 ? -0.5 : 0.5;
  const towardOpen = Math.sign(prop.openingLine - prop.line) * 0.5;
  const next = Math.random() < 0.35 ? prop.line + towardOpen : prop.line + delta;
  const min = Math.max(0.5, prop.openingLine - 3);
  const max = prop.openingLine + 3;
  return Math.min(max, Math.max(min, next));
}

function bumpLiveStat(prop: Prop): number | null {
  if (prop.liveStat == null) return prop.liveStat;
  const step =
    prop.stat === "pass_yds" || prop.stat === "rush_yds"
      ? 2 + Math.floor(Math.random() * 9)
      : Math.random() < 0.55
        ? 1
        : 0;
  return prop.liveStat + step;
}

export class LiveEngine extends EventEmitter {
  private props = new Map<string, Prop>();
  private history = new Map<string, RingBuffer<Tick>>();
  private entries: Entry[] = [];
  private seq = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private entrySeq = 0;

  constructor() {
    super();
    this.setMaxListeners(64);
    for (const prop of seedSlate()) {
      this.props.set(prop.id, prop);
      const buf = new RingBuffer<Tick>(MAX_TICKS_PER_PROP);
      buf.push({ t: prop.updatedAt, line: prop.line, liveStat: prop.liveStat });
      this.history.set(prop.id, buf);
    }
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
      ...cloneProp(prop),
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
    return {
      ...cloneProp(prop),
      history: this.history.get(id)?.toArray() ?? [],
    };
  }

  health() {
    return {
      ok: true,
      product: "LineLock",
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

  private tick(): void {
    const ids = [...this.props.keys()];
    const liveIds = ids.filter((id) => this.props.get(id)?.gameStatus === "live");
    const scheduled = ids.filter((id) => this.props.get(id)?.gameStatus === "scheduled");
    const updates: WsBatch["updates"] = [];
    const n = 2 + Math.floor(Math.random() * 3);
    const pool = liveIds.length ? liveIds : scheduled;
    if (!pool.length) return;

    for (let i = 0; i < n; i++) {
      const id = pool[Math.floor(Math.random() * pool.length)];
      const prop = this.props.get(id);
      if (!prop || prop.gameStatus === "final") continue;

      if (prop.gameStatus === "scheduled" && Math.random() < 0.04) {
        prop.gameStatus = "live";
        prop.clock = "Q1 12:00";
        prop.liveStat = 0;
      }

      if (prop.gameStatus === "live") {
        if (Math.random() < 0.55) {
          prop.liveStat = bumpLiveStat(prop);
        } else {
          prop.line = nudgeLine(prop);
        }
        prop.clock = stepLiveClock(prop.clock);
        if (prop.clock === "Final") {
          prop.gameStatus = "final";
        }
      } else if (Math.random() < 0.4) {
        prop.line = nudgeLine(prop);
      }

      prop.updatedAt = Date.now();
      const tick: Tick = {
        t: prop.updatedAt,
        line: prop.line,
        liveStat: prop.liveStat,
      };
      this.history.get(id)?.push(tick);
      updates.push({ id, prop: cloneProp(prop), tick });
    }

    if (!updates.length) return;
    this.seq += 1;
    const batch: WsBatch = { type: "batch", seq: this.seq, updates };
    this.emit("batch", batch);
  }
}

export const liveEngine = new LiveEngine();

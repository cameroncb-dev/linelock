export type Sport = "NBA" | "NFL";
export type GameStatus = "scheduled" | "live" | "final";
export type PickSide = "more" | "less";

export type StatType =
  | "points"
  | "rebounds"
  | "assists"
  | "threes"
  | "pass_yds"
  | "rush_yds"
  | "receptions";

export type Prop = {
  id: string;
  /** Props in the same game share one simulated clock. */
  gameId: string;
  sport: Sport;
  player: string;
  team: string;
  opponent: string;
  position: string;
  stat: StatType;
  statLabel: string;
  line: number;
  openingLine: number;
  liveStat: number | null;
  gameStatus: GameStatus;
  clock: string;
  updatedAt: number;
};

export type Tick = {
  t: number;
  line: number;
  liveStat: number | null;
};

export type PropView = Prop & { history: Tick[] };

export type MemoryStats = {
  maxTicksPerProp: number;
  propCount: number;
  tickCount: number;
  clientCap: number;
};

export type Snapshot = {
  seq: number;
  generatedAt: number;
  props: PropView[];
  memory: MemoryStats;
};

export type WsHello = { type: "hello" } & Snapshot;

export type PropUpdate = {
  id: string;
  prop: Prop;
  tick: Tick;
};

export type WsBatch = {
  type: "batch";
  seq: number;
  updates: PropUpdate[];
};

export type WsMessage = WsHello | WsBatch;

export type SlipLeg = {
  propId: string;
  side: PickSide;
  lockedLine: number;
};

export type EntryRequest = {
  legs: SlipLeg[];
};

export type Entry = {
  id: string;
  createdAt: number;
  legs: SlipLeg[];
  multiplier: number;
  status: "pending";
};

export const MAX_TICKS_PER_PROP = 48;
export const MAX_SLIP_LEGS = 6;
export const MIN_SLIP_LEGS = 2;
export const MAX_WS_CLIENTS = 32;
export const MAX_ENTRIES = 100;

export const DEMO_MULTIPLIERS: Record<number, number> = {
  2: 3,
  3: 5,
  4: 10,
  5: 20,
  6: 25,
};

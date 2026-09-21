import { create } from "zustand";
import { RingBuffer } from "@/lib/ring-buffer";
import {
  MAX_SLIP_LEGS,
  MAX_TICKS_PER_PROP,
  type MemoryStats,
  type PickSide,
  type Prop,
  type SlipLeg,
  type Sport,
  type Tick,
} from "@/lib/types";

export type ConnectionState = "idle" | "connecting" | "live" | "reconnecting" | "offline";
export type SportFilter = "ALL" | Sport;
export type StatusFilter = "ALL" | "live" | "scheduled" | "final";

export type BoardProp = Prop & { history: Tick[] };

export type SubmitResult = { ok: boolean; message: string };

type BoardState = {
  connection: ConnectionState;
  error: string | null;
  seq: number;
  props: Record<string, BoardProp>;
  memory: MemoryStats | null;
  sport: SportFilter;
  status: StatusFilter;
  query: string;
  slip: SlipLeg[];
  lastSubmit: SubmitResult | null;
  setFilters: (patch: Partial<Pick<BoardState, "sport" | "status" | "query">>) => void;
  hydrate: (props: BoardProp[], seq: number, memory: MemoryStats) => void;
  applyBatch: (seq: number, updates: { prop: Prop; tick: Tick }[]) => void;
  setConnection: (connection: ConnectionState, error?: string | null) => void;
  toggleLeg: (prop: Prop, side: PickSide) => void;
  removeLeg: (propId: string) => void;
  relockLeg: (prop: Prop) => void;
  clearSlip: () => void;
  setLastSubmit: (result: SubmitResult | null) => void;
};

function toBoardProp(prop: Prop, history: Tick[]): BoardProp {
  const buf = new RingBuffer<Tick>(MAX_TICKS_PER_PROP);
  for (const tick of history.slice(-MAX_TICKS_PER_PROP)) buf.push(tick);
  return { ...prop, history: buf.toArray() };
}

export const useBoardStore = create<BoardState>((set, get) => ({
  connection: "idle",
  error: null,
  seq: 0,
  props: {},
  memory: null,
  sport: "ALL",
  status: "ALL",
  query: "",
  slip: [],
  lastSubmit: null,

  setFilters: (patch) => set(patch),

  hydrate: (list, seq, memory) => {
    const props: Record<string, BoardProp> = {};
    for (const prop of list) {
      props[prop.id] = toBoardProp(prop, prop.history);
    }
    set({ props, seq, memory, error: null });
  },

  applyBatch: (seq, updates) => {
    set((state) => {
      const props = { ...state.props };
      for (const update of updates) {
        const prev = props[update.prop.id];
        const history = [...(prev?.history ?? []), update.tick].slice(-MAX_TICKS_PER_PROP);
        props[update.prop.id] = { ...update.prop, history };
      }
      return { props, seq };
    });
  },

  setConnection: (connection, error = null) => set({ connection, error }),

  toggleLeg: (prop, side) => {
    const { slip } = get();
    const existing = slip.find((leg) => leg.propId === prop.id);
    if (existing?.side === side) {
      set({ slip: slip.filter((leg) => leg.propId !== prop.id), lastSubmit: null });
      return;
    }
    if (existing) {
      set({
        slip: slip.map((leg) =>
          leg.propId === prop.id ? { ...leg, side, lockedLine: prop.line } : leg,
        ),
        lastSubmit: null,
      });
      return;
    }
    if (slip.length >= MAX_SLIP_LEGS) return;
    if (prop.gameStatus === "final") return;
    set({
      slip: [...slip, { propId: prop.id, side, lockedLine: prop.line }],
      lastSubmit: null,
    });
  },

  removeLeg: (propId) =>
    set({ slip: get().slip.filter((leg) => leg.propId !== propId), lastSubmit: null }),

  relockLeg: (prop) =>
    set({
      slip: get().slip.map((leg) =>
        leg.propId === prop.id ? { ...leg, lockedLine: prop.line } : leg,
      ),
    }),

  clearSlip: () => set({ slip: [], lastSubmit: null }),
  setLastSubmit: (lastSubmit) => set({ lastSubmit }),
}));

export function selectVisibleProps(
  state: Pick<BoardState, "props" | "sport" | "status" | "query">,
): BoardProp[] {
  const q = state.query.trim().toLowerCase();
  return Object.values(state.props)
    .filter((prop) => (state.sport === "ALL" ? true : prop.sport === state.sport))
    .filter((prop) => (state.status === "ALL" ? true : prop.gameStatus === state.status))
    .filter((prop) => {
      if (!q) return true;
      return (
        prop.player.toLowerCase().includes(q) ||
        prop.team.toLowerCase().includes(q) ||
        prop.statLabel.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      const rank = { live: 0, scheduled: 1, final: 2 };
      return rank[a.gameStatus] - rank[b.gameStatus] || a.player.localeCompare(b.player);
    });
}

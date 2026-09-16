"use client";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  DEMO_MULTIPLIERS,
  MAX_SLIP_LEGS,
  MIN_SLIP_LEGS,
  type Entry,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { useBoardStore } from "@/store/board-store";

export function SlipPanel({ className }: { className?: string }) {
  const props = useBoardStore((s) => s.props);
  const slip = useBoardStore((s) => s.slip);
  const removeLeg = useBoardStore((s) => s.removeLeg);
  const relockLeg = useBoardStore((s) => s.relockLeg);
  const clearSlip = useBoardStore((s) => s.clearSlip);
  const lastSubmit = useBoardStore((s) => s.lastSubmit);
  const setLastSubmit = useBoardStore((s) => s.setLastSubmit);

  const multiplier = DEMO_MULTIPLIERS[slip.length];
  const canSubmit = slip.length >= MIN_SLIP_LEGS && slip.length <= MAX_SLIP_LEGS;

  async function submit() {
    const res = await fetch("/api/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ legs: slip }),
    });
    const data = await res.json();
    if (!res.ok) {
      setLastSubmit(data.error ?? "Could not lock the slip.");
      return;
    }
    const entry = data.entry as Entry;
    setLastSubmit(`Locked ${entry.id} · demo ${entry.multiplier}x · not a wager`);
    clearSlip();
  }

  return (
    <aside
      className={cn(
        "flex h-full flex-col rounded-xl bg-card/80 ring-1 ring-white/8",
        className,
      )}
    >
      <div className="px-4 py-3">
        <div className="font-heading text-sm font-semibold tracking-wide uppercase">
          Slip
        </div>
        <p className="text-xs text-muted-foreground">
          {slip.length}/{MAX_SLIP_LEGS} picks · {MIN_SLIP_LEGS} min to lock
        </p>
      </div>
      <Separator />
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-3 p-4">
          {slip.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Tap More or Less on a player. Lines keep moving; drifted picks must
              be re-locked before submit.
            </p>
          )}
          {slip.map((leg) => {
            const prop = props[leg.propId];
            if (!prop) return null;
            const drifted = prop.line !== leg.lockedLine;
            return (
              <div
                key={leg.propId}
                className="rounded-lg bg-background/50 p-3 ring-1 ring-white/6"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-medium">{prop.player}</div>
                    <div className="text-xs text-muted-foreground">
                      {leg.side.toUpperCase()} {leg.lockedLine} {prop.statLabel}
                    </div>
                  </div>
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() => removeLeg(leg.propId)}
                  >
                    Remove
                  </Button>
                </div>
                {drifted && (
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-amber-300">
                      Now {prop.line}
                    </span>
                    <Button size="xs" variant="outline" onClick={() => relockLeg(prop)}>
                      Re-lock
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>
      <Separator />
      <div className="flex flex-col gap-2 p-4">
        {lastSubmit && (
          <p className="text-xs text-live">{lastSubmit}</p>
        )}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Demo multiplier</span>
          <span className="font-heading font-semibold">
            {multiplier ? `${multiplier}x` : "—"}
          </span>
        </div>
        <Button className="h-10 w-full" disabled={!canSubmit} onClick={() => void submit()}>
          Lock slip
        </Button>
        <p className="text-[11px] leading-snug text-muted-foreground">
          Simulated lines only. No real money, no PrizePicks odds, no sportsbook
          account.
        </p>
      </div>
    </aside>
  );
}

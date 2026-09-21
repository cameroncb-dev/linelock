"use client";

import { Sparkline } from "@/components/board/sparkline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useBoardStore, type BoardProp } from "@/store/board-store";

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("");
}

function lineDelta(prop: BoardProp) {
  const delta = prop.line - prop.openingLine;
  if (delta === 0) return "open";
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta.toFixed(1)} vs open`;
}

export function PropCard({ prop }: { prop: BoardProp }) {
  const slip = useBoardStore((s) => s.slip);
  const toggleLeg = useBoardStore((s) => s.toggleLeg);
  const leg = slip.find((item) => item.propId === prop.id);
  const drifted = Boolean(leg && leg.lockedLine !== prop.line);
  // The bar is capped at the line; the label is not, so a stat that has already
  // cleared its number reads as "112% of line" rather than a full bar at 100%.
  const livePct =
    prop.liveStat == null ? null : (prop.liveStat / Math.max(prop.line, 0.5)) * 100;

  return (
    <Card className="border-0 bg-card/80 py-3 shadow-none ring-1 ring-white/8">
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/15 font-heading text-sm font-semibold tracking-wide text-primary">
              {initials(prop.player)}
            </div>
            <div className="min-w-0">
              <div className="truncate font-heading text-base font-semibold">
                {prop.player}
              </div>
              <div className="text-xs text-muted-foreground">
                {prop.team} vs {prop.opponent} · {prop.position}
              </div>
            </div>
          </div>
          <Badge
            variant="outline"
            className={cn(
              "capitalize",
              prop.gameStatus === "live" && "border-live/40 bg-live/15 text-live",
              prop.gameStatus === "scheduled" && "text-muted-foreground",
              prop.gameStatus === "final" && "text-muted-foreground",
            )}
          >
            {prop.gameStatus === "live" ? "Live" : prop.gameStatus}
          </Badge>
        </div>

        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-xs tracking-wide text-muted-foreground uppercase">
              {prop.statLabel}
            </div>
            <div className="font-heading text-3xl font-semibold tabular-nums leading-none">
              {prop.line}
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              {lineDelta(prop)} · {prop.clock}
            </div>
          </div>
          <Sparkline history={prop.history} />
        </div>

        {livePct != null && (
          <div>
            <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
              <span>Live {prop.liveStat}</span>
              <span>{Math.round(livePct)}% of line</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full",
                  livePct >= 100 ? "bg-more" : "bg-live/70",
                )}
                style={{ width: `${Math.min(100, livePct)}%` }}
              />
            </div>
          </div>
        )}

        {drifted && (
          <p className="text-[11px] text-amber-300">
            Line moved since you locked {leg?.lockedLine}. Re-pick to update.
          </p>
        )}

        <div className="grid grid-cols-2 gap-2">
          <Button
            variant={leg?.side === "more" ? "default" : "outline"}
            className={cn(
              "h-10 font-semibold",
              leg?.side === "more" && "bg-more text-black hover:bg-more/90",
            )}
            disabled={prop.gameStatus === "final"}
            onClick={() => toggleLeg(prop, "more")}
          >
            More
          </Button>
          <Button
            variant={leg?.side === "less" ? "default" : "outline"}
            className={cn(
              "h-10 font-semibold",
              leg?.side === "less" && "bg-less text-black hover:bg-less/90",
            )}
            disabled={prop.gameStatus === "final"}
            onClick={() => toggleLeg(prop, "less")}
          >
            Less
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

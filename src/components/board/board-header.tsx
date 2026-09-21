"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useBoardStore, type SportFilter, type StatusFilter } from "@/store/board-store";

const sports: SportFilter[] = ["ALL", "NBA", "NFL"];
const statuses: { id: StatusFilter; label: string }[] = [
  { id: "ALL", label: "All" },
  { id: "live", label: "Live" },
  { id: "scheduled", label: "Upcoming" },
  { id: "final", label: "Final" },
];

export function BoardHeader() {
  const connection = useBoardStore((s) => s.connection);
  const memory = useBoardStore((s) => s.memory);
  const sport = useBoardStore((s) => s.sport);
  const status = useBoardStore((s) => s.status);
  const query = useBoardStore((s) => s.query);
  const setFilters = useBoardStore((s) => s.setFilters);
  const slipCount = useBoardStore((s) => s.slip.length);

  return (
    <header className="sticky top-0 z-20 border-b border-white/8 bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-heading text-lg font-semibold tracking-tight">
              LineLock
            </div>
            <p className="hidden text-xs text-muted-foreground sm:block">
              Live more/less board · intern demo, not a book
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={cn(
                "gap-1.5",
                connection === "live" && "border-live/40 text-live",
                connection === "reconnecting" && "border-amber-400/40 text-amber-300",
                (connection === "offline" || connection === "idle") &&
                  "text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  connection === "live" ? "animate-pulse bg-live" : "bg-muted-foreground",
                )}
              />
              {connection === "live"
                ? "Live feed"
                : connection === "reconnecting"
                  ? "Reconnecting"
                  : connection === "offline"
                    ? "Offline"
                    : "Connecting"}
            </Badge>
            <Badge variant="outline" className="hidden sm:inline-flex">
              {slipCount} on slip
            </Badge>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex flex-wrap gap-1.5">
            {sports.map((item) => (
              <Button
                key={item}
                size="sm"
                variant={sport === item ? "default" : "outline"}
                onClick={() => setFilters({ sport: item })}
              >
                {item === "ALL" ? "All sports" : item}
              </Button>
            ))}
            {statuses.map((item) => (
              <Button
                key={item.id}
                size="sm"
                variant={status === item.id ? "secondary" : "ghost"}
                onClick={() => setFilters({ status: item.id })}
              >
                {item.label}
              </Button>
            ))}
          </div>
          <Input
            value={query}
            onChange={(e) => setFilters({ query: e.target.value })}
            placeholder="Search player or team"
            aria-label="Search player or team"
            className="h-8 flex-1"
          />
        </div>

        {memory && (
          <p className="text-[11px] text-muted-foreground">
            Memory cap {memory.maxTicksPerProp} ticks/prop · {memory.tickCount} ticks
            in ram · WS clients ≤ {memory.clientCap}
          </p>
        )}
      </div>
    </header>
  );
}

"use client";

import { BoardHeader } from "@/components/board/board-header";
import { PropCard } from "@/components/board/prop-card";
import { SlipPanel } from "@/components/board/slip-panel";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useLiveFeed } from "@/hooks/use-live-feed";
import { selectVisibleProps, useBoardStore } from "@/store/board-store";

function BoardGrid() {
  const visible = useBoardStore(selectVisibleProps);
  const connection = useBoardStore((s) => s.connection);
  const error = useBoardStore((s) => s.error);
  const count = useBoardStore((s) => Object.keys(s.props).length);

  if (connection === "offline" && !count) {
    return (
      <div className="rounded-xl bg-card/60 p-8 text-center ring-1 ring-white/8">
        <h2 className="font-heading text-lg font-semibold">Feed is offline</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {error ?? "Could not reach the mock line server."}
        </p>
      </div>
    );
  }

  if (!count) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-56 rounded-xl" />
        ))}
      </div>
    );
  }

  if (!visible.length) {
    return (
      <div className="rounded-xl bg-card/60 p-8 text-center ring-1 ring-white/8">
        <h2 className="font-heading text-lg font-semibold">No props match</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Clear the search or switch sport / live filters.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {visible.map((prop) => (
        <PropCard key={prop.id} prop={prop} />
      ))}
    </div>
  );
}

export function LiveBoard() {
  useLiveFeed();
  const slipCount = useBoardStore((s) => s.slip.length);

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <BoardHeader />
      <div className="mx-auto flex w-full max-w-7xl flex-1 gap-4 px-4 py-4 sm:px-6">
        <main className="min-w-0 flex-1">
          <BoardGrid />
        </main>
        <div className="hidden w-80 shrink-0 lg:block">
          <div className="sticky top-28 h-[calc(100vh-8rem)]">
            <SlipPanel className="h-full" />
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 z-20 border-t border-white/8 bg-background/95 p-3 lg:hidden">
        <Sheet>
          <SheetTrigger render={<Button className="h-11 w-full" />}>
            Open slip · {slipCount} pick{slipCount === 1 ? "" : "s"}
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[80vh] p-0">
            <SheetHeader className="sr-only">
              <SheetTitle>Slip</SheetTitle>
            </SheetHeader>
            <SlipPanel className="h-full rounded-none ring-0" />
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}

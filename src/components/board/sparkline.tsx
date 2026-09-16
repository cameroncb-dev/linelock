import type { Tick } from "@/lib/types";
import { cn } from "@/lib/utils";

export function Sparkline({
  history,
  className,
}: {
  history: Tick[];
  className?: string;
}) {
  const values = history.map((tick) => tick.line);
  if (values.length < 2) {
    return (
      <div className={cn("text-[11px] text-muted-foreground", className)}>
        Waiting on ticks
      </div>
    );
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 0.5;
  const w = 120;
  const h = 28;
  const d = values
    .map((value, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - ((value - min) / span) * (h - 4) - 2;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const up = values[values.length - 1] >= values[0];

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={cn("h-7 w-[120px]", className)}
      aria-hidden
    >
      <path
        d={d}
        fill="none"
        stroke={up ? "var(--more)" : "var(--less)"}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

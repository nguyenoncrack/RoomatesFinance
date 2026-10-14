import type { ReactNode } from "react";
import type { TickerTrend } from "@/lib/ticker";
import { cn } from "@/lib/utils";

export interface TickerItem {
  id: string;
  icon?: ReactNode;
  label: ReactNode;
  value?: string;
  trend: TickerTrend;
}

const TREND = {
  up: { glyph: "▲", className: "text-positive" },
  down: { glyph: "▼", className: "text-negative" },
  flat: { glyph: "•", className: "text-muted-foreground" },
} as const;

function Row({ items, hidden }: { items: TickerItem[]; hidden?: boolean }) {
  return (
    <ul className="flex shrink-0 items-center" aria-hidden={hidden || undefined}>
      {items.map((item) => {
        const t = TREND[item.trend];
        return (
          <li key={item.id} className="flex items-center gap-2 px-5 text-xs whitespace-nowrap">
            <span className="size-1 rounded-full bg-primary/60" />
            {item.icon}
            <span className="text-foreground/85">{item.label}</span>
            {item.value ? <span className={cn("font-mono font-medium tabular-nums", t.className)}>{item.value}</span> : null}
            <span className={cn("text-[10px]", t.className)}>{t.glyph}</span>
          </li>
        );
      })}
    </ul>
  );
}

/** Seamless scrolling strip of market-style updates; pauses on hover and stops for reduced motion. */
export function Ticker({ items, label, className }: { items: TickerItem[]; label: string; className?: string }) {
  if (items.length === 0) return null;
  return (
    <div
      role="region"
      aria-label={label}
      className={cn(
        "group relative overflow-hidden border-y border-foreground/[0.06] bg-foreground/[0.015] py-2.5 [mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)]",
        className,
      )}
    >
      <div
        className="flex w-max animate-ticker group-hover:[animation-play-state:paused]"
        style={{ ["--ticker-duration" as string]: `${Math.max(24, items.length * 5)}s` }}
      >
        <Row items={items} />
        <Row items={items} hidden />
      </div>
    </div>
  );
}

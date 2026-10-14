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
  up: { glyph: "↗", className: "text-positive" },
  down: { glyph: "↘", className: "text-negative" },
  flat: { glyph: "~", className: "text-muted-foreground" },
} as const;

/** Tiny four-point sparkle used as the bullet between items. */
function Spark() {
  return (
    <svg viewBox="0 0 12 12" className="size-2.5 shrink-0 text-foreground" aria-hidden>
      <path d="M6 .8c.4 2.6 1.2 3.6 4.4 5.2C7.2 7.6 6.4 8.6 6 11.2 5.6 8.6 4.8 7.6 1.6 6 4.8 4.4 5.6 3.4 6 .8z" fill="var(--pop-yellow)" stroke="currentColor" strokeWidth={1} strokeLinejoin="round" />
    </svg>
  );
}

function Row({ items, hidden }: { items: TickerItem[]; hidden?: boolean }) {
  return (
    <ul className="flex shrink-0 items-center" aria-hidden={hidden || undefined}>
      {items.map((item) => {
        const t = TREND[item.trend];
        return (
          <li key={item.id} className="flex items-center gap-2 px-5 font-hand text-[17px] leading-none whitespace-nowrap">
            <Spark />
            {item.icon}
            <span className="text-foreground/85">{item.label}</span>
            {item.value ? <span className={cn("text-lg", t.className)}>{item.value}</span> : null}
            <span className={cn("text-lg font-bold", t.className)}>{t.glyph}</span>
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
        "group relative overflow-hidden bg-butter/35 bg-[image:var(--pencil-divider),var(--pencil-divider)] bg-[length:60px_6px] bg-[position:left_top,left_bottom] bg-repeat-x py-2 [mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)]",
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

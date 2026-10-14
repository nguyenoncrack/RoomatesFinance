import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Charcoal "night" panel used for hero summaries: a mono caption row on top, a centerpiece
 * (usually a PencilRing), and an optional footer of stats separated by hairlines.
 */
export function NightPanel({
  eyebrow,
  index,
  children,
  footer,
  className,
}: {
  eyebrow: string;
  /** Right-hand caption, e.g. "01 / 03". */
  index?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl bg-night text-night-foreground ring-1 ring-foreground/20",
        "bg-[radial-gradient(40rem_22rem_at_50%_40%,oklch(1_0_0/6%),transparent_65%)]",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3 px-5 pt-4 font-label text-night-foreground/60">
        <span>
          <span aria-hidden>• </span>
          {eyebrow}
        </span>
        {index ? <span className="tabular-nums">{index}</span> : null}
      </div>
      <div className="px-5 py-4">{children}</div>
      {footer ? <div className="border-t border-night-foreground/10">{footer}</div> : null}
    </div>
  );
}

export function StatTile({
  label,
  value,
  tone = "neutral",
  hint,
}: {
  label: string;
  value: ReactNode;
  tone?: "positive" | "negative" | "neutral";
  hint?: ReactNode;
}) {
  return (
    <div className="min-w-0 px-4 py-3.5 text-center">
      <p className="font-label text-night-foreground/50">{label}</p>
      <p
        className={cn(
          "mt-1 truncate font-display text-2xl leading-none tabular-nums",
          tone === "positive" && "text-[oklch(0.8_0.09_140)]",
          tone === "negative" && "text-[oklch(0.78_0.11_45)]",
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 truncate font-label text-[9.5px] text-night-foreground/45">{hint}</p> : null}
    </div>
  );
}

/** Footer row for NightPanel: equal columns split by hairlines. */
export function StatRow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("grid grid-cols-2 divide-night-foreground/10 sm:grid-cols-4 sm:divide-x [&>*:nth-child(odd)]:max-sm:border-r [&>*:nth-child(odd)]:max-sm:border-night-foreground/10 [&>*:nth-child(-n+2)]:max-sm:border-b [&>*:nth-child(-n+2)]:max-sm:border-night-foreground/10", className)}>
      {children}
    </div>
  );
}

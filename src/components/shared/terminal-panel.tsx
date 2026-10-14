import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Code-editor style panel with a "live" status pill, used for hero summaries. */
export function TerminalPanel({
  status = "Live",
  command,
  children,
  footer,
  className,
}: {
  status?: string;
  command: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-primary/20 bg-linear-to-b from-card to-background/60 p-3 glow-soft sm:p-4",
        className,
      )}
    >
      <div className="pointer-events-none absolute -top-24 left-1/2 size-72 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
      <div className="relative flex items-center justify-between gap-3 px-1 pb-3">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-accent-foreground">
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60" />
            <span className="relative inline-flex size-1.5 rounded-full bg-primary" />
          </span>
          {status}
        </span>
        <span className="truncate font-mono text-[11px] text-muted-foreground">{command}</span>
      </div>
      <div className="relative rounded-xl border border-white/[0.06] bg-black/30 px-4 py-3.5 font-mono text-[12.5px] leading-6 sm:text-[13px]">
        {children}
      </div>
      {footer ? <div className="relative mt-3">{footer}</div> : null}
    </div>
  );
}

export function CodeComment({ children }: { children: ReactNode }) {
  return <div className="text-muted-foreground/80 italic">{"// "}{children}</div>;
}

export function Cursor() {
  return <span className="ml-0.5 inline-block h-4 w-2 translate-y-0.5 animate-blink bg-primary/80" aria-hidden />;
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
    <div className="min-w-0 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-center transition-colors hover:border-primary/25 hover:bg-primary/[0.04]">
      <p className="text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase">{label}</p>
      <p
        className={cn(
          "mt-1 truncate font-display text-base font-semibold tabular-nums sm:text-lg",
          tone === "positive" && "text-positive",
          tone === "negative" && "text-negative",
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

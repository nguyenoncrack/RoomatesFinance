import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
  tone = "primary",
  className,
}: {
  icon: LucideIcon;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  tone?: "primary" | "positive" | "neutral";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2 rounded-xl border border-dashed border-white/10 bg-white/[0.015] px-4 py-8 text-center",
        className,
      )}
    >
      <span
        className={cn(
          "mb-1 flex size-11 items-center justify-center rounded-2xl ring-1",
          tone === "positive" && "bg-positive-soft text-positive ring-positive/25 shadow-[0_0_24px_-6px] shadow-positive/50",
          tone === "primary" && "bg-primary/10 text-accent-foreground ring-primary/25 shadow-[0_0_24px_-6px] shadow-primary/50",
          tone === "neutral" && "bg-white/5 text-muted-foreground ring-white/10",
        )}
      >
        <Icon className="size-5" />
      </span>
      <p className="font-display text-base font-semibold">{title}</p>
      {children ? <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">{children}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

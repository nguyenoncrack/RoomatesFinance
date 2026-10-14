"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const SPARKLES = [
  { left: "8%", top: "18%", delay: 0 },
  { left: "86%", top: "8%", delay: 0.8 },
  { left: "80%", top: "62%", delay: 1.6 },
];

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
      <div className="relative mb-2 flex h-16 w-24 items-start justify-center" aria-hidden>
        {SPARKLES.map((sp, i) => (
          <motion.span
            key={i}
            className={cn("absolute size-1 rounded-full", tone === "neutral" ? "bg-white/40" : "bg-primary")}
            style={{ left: sp.left, top: sp.top }}
            animate={{ opacity: [0, 1, 0], scale: [0.4, 1.2, 0.4] }}
            transition={{ duration: 2.4, repeat: Infinity, delay: sp.delay, ease: "easeInOut" }}
          />
        ))}
        <motion.span
          animate={{ y: [0, -5, 0], rotate: [0, -3, 0] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
          className={cn(
            "relative flex size-12 items-center justify-center rounded-2xl ring-1",
            tone === "positive" && "bg-positive-soft text-positive ring-positive/25 shadow-[0_0_24px_-6px] shadow-positive/50",
            tone === "primary" && "bg-primary/10 text-accent-foreground ring-primary/25 shadow-[0_0_24px_-6px] shadow-primary/50",
            tone === "neutral" && "bg-white/5 text-muted-foreground ring-white/10",
          )}
        >
          <Icon className="size-5" />
        </motion.span>
        <motion.span
          className="absolute bottom-0 h-1.5 w-10 rounded-full bg-black/50 blur-[2px]"
          animate={{ scaleX: [1, 0.75, 1], opacity: [0.7, 0.4, 0.7] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>
      <p className="font-display text-base font-medium">{title}</p>
      {children ? <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">{children}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

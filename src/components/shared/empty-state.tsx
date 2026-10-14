"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { SparkleDoodle, SquiggleDoodle } from "@/components/shared/doodles";
import { cn } from "@/lib/utils";

const BLOB_FILL = {
  primary: "var(--pop-yellow)",
  positive: "var(--pop-green)",
  neutral: "var(--lilac)",
} as const;

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
    <div className={cn("flex flex-col items-center gap-2 rounded-2xl px-4 py-7 text-center", className)}>
      <div className="relative mb-2 h-24 w-32" aria-hidden>
        <SparkleDoodle className="absolute top-1 left-1 size-5 animate-wiggle [--wiggle-amount:20deg]" color="var(--pop-pink)" />
        <SparkleDoodle className="absolute top-8 right-0 size-4 animate-wiggle [--wiggle-amount:-24deg] [--wiggle-duration:2s]" color="var(--pop-blue)" />
        <motion.div
          animate={{ y: [0, -5, 0], rotate: [-4, 2, -4] }}
          transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut" }}
          className="absolute inset-x-0 top-2 mx-auto size-[4.5rem]"
        >
          <svg viewBox="0 0 80 80" className="absolute inset-0 size-full overflow-visible text-foreground">
            <path
              d="M42 4c14 1 30 10 33 26 3 15-5 31-20 38-14 7-33 4-43-8C2 48 2 30 11 18 18 8 29 3 42 4z"
              fill="currentColor"
              transform="translate(3 3)"
            />
            <path
              d="M42 4c14 1 30 10 33 26 3 15-5 31-20 38-14 7-33 4-43-8C2 48 2 30 11 18 18 8 29 3 42 4z"
              fill={BLOB_FILL[tone]}
              stroke="currentColor"
              strokeWidth={2.4}
            />
          </svg>
          <Icon className="relative m-auto mt-[1.35rem] size-7 text-foreground" strokeWidth={2} />
        </motion.div>
        <SquiggleDoodle className="absolute bottom-0 left-1/2 w-16 -translate-x-1/2 opacity-40" />
      </div>
      <p className="font-display text-2xl leading-tight">{title}</p>
      {children ? <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">{children}</p> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

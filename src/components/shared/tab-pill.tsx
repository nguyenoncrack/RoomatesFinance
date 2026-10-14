"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Sliding highlight for segmented controls. Render it inside the active item only; items sharing a
 * `group` animate the pill between them. The item needs `relative isolate` so the pill sits under its label.
 */
export function TabPill({ group, className }: { group: string; className?: string }) {
  return (
    <motion.span
      layoutId={`tab-pill-${group}`}
      className={cn("absolute inset-0 -z-10 rounded-[inherit] bg-primary/15 ring-1 ring-primary/35", className)}
      transition={{ type: "spring", stiffness: 500, damping: 38 }}
    />
  );
}

"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const SIZE = 320;
const C = SIZE / 2;
const R = 104;
const EASE = [0.65, 0, 0.35, 1] as const;

/**
 * Concentric hairline circles with a progress arc drawn over the main ring and a small dot
 * riding its tip, after the "orbit" sections of editorial landing pages. Content sits centered.
 */
export function PencilRing({
  progress,
  children,
  className,
}: {
  /** 0..1, how much of the main ring the arc covers. */
  progress: number;
  children: ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const p = Math.min(Math.max(progress, 0), 1);
  // Arc starts at 12 o'clock and runs clockwise.
  const angle = p * 2 * Math.PI - Math.PI / 2;
  const tip = { x: C + R * Math.cos(angle), y: C + R * Math.sin(angle) };
  const rings = Array.from({ length: 9 }, (_, i) => R + 10 + i * 5);

  return (
    <div className={cn("relative mx-auto aspect-square w-full max-w-[320px]", className)}>
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="absolute inset-0 size-full overflow-visible text-current" aria-hidden>
        {rings.map((r, i) => (
          <motion.circle
            key={r}
            cx={C}
            cy={C}
            r={r}
            className="pencil-stroke"
            strokeWidth={0.6}
            initial={reduce ? false : { opacity: 0, scale: 0.94 }}
            animate={{ opacity: 0.22 - i * 0.02, scale: 1 }}
            transition={{ duration: 0.9, delay: 0.05 * i, ease: EASE }}
            style={{ transformOrigin: "50% 50%" }}
          />
        ))}
        <circle cx={C} cy={C} r={R} className="pencil-stroke opacity-30" strokeWidth={0.75} />
        <motion.circle
          cx={C}
          cy={C}
          r={R}
          className="pencil-stroke text-pop-yellow"
          strokeWidth={3}
          transform={`rotate(-90 ${C} ${C})`}
          initial={reduce ? false : { pathLength: 0 }}
          animate={{ pathLength: p }}
          transition={{ duration: 1.4, delay: 0.2, ease: EASE }}
        />
        {p > 0 ? (
          <motion.g initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.4, duration: 0.4 }}>
            <circle cx={tip.x} cy={tip.y} r={9} className="pencil-stroke opacity-40" strokeWidth={0.6} />
            <circle cx={tip.x} cy={tip.y} r={5} fill="var(--pop-pink)" stroke="currentColor" strokeWidth={1.5} />
          </motion.g>
        ) : null}
      </svg>
      <div className="absolute inset-[22%] flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}

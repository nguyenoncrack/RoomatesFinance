"use client";

import { animate, motion, useAnimate, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import { useEffect, useRef } from "react";
import { formatCents } from "@/lib/domain/money";
import { cn } from "@/lib/utils";

const FLASH_UP = "rgba(96, 128, 76, 0.18)";
const FLASH_DOWN = "rgba(184, 98, 66, 0.18)";
const CLEAR = "rgba(0, 0, 0, 0)";

/**
 * Display-only money figure that counts up on mount and ticks to new values like a stock quote,
 * flashing green when it rises and red when it falls. The rendered text is always formatted from
 * whole cents, so in-between frames never show fractional amounts.
 */
export function AnimatedMoney({
  cents,
  signed = false,
  absolute = false,
  flash = true,
  className,
}: {
  cents: number;
  signed?: boolean;
  absolute?: boolean;
  flash?: boolean;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const value = useMotionValue(0);
  const text = useTransform(value, (v) => {
    const c = Math.round(v);
    return absolute ? formatCents(Math.abs(c)) : formatCents(c, { signed });
  });
  const [scope, animateScope] = useAnimate<HTMLSpanElement>();
  const previous = useRef<number | null>(null);

  useEffect(() => {
    const from = previous.current;
    previous.current = cents;
    if (reduce) {
      value.set(cents);
      return;
    }
    const controls = animate(value, cents, { duration: from === null ? 0.9 : 0.55, ease: [0.22, 1, 0.36, 1] });
    if (flash && from !== null && from !== cents && scope.current) {
      animateScope(scope.current, { backgroundColor: [cents > from ? FLASH_UP : FLASH_DOWN, CLEAR] }, { duration: 0.9, ease: "easeOut" });
    }
    return () => controls.stop();
  }, [cents, reduce, flash, value, scope, animateScope]);

  return (
    <motion.span ref={scope} className={cn("-mx-1 rounded-md px-1 tabular-nums", className)} aria-label={absolute ? formatCents(Math.abs(cents)) : formatCents(cents, { signed })}>
      {text}
    </motion.span>
  );
}

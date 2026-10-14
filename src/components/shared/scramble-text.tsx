"use client";

import { useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const GLYPHS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

/**
 * Letters arrive left to right; the ones still on their way show as faint random glyphs,
 * like type being set. Screen readers get the final text straight away.
 */
export function ScrambleText({
  text,
  duration = 750,
  delay = 0,
  className,
}: {
  text: string;
  duration?: number;
  delay?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const [frame, setFrame] = useState<{ text: string; settled: number; noise: string }>(() => ({
    text,
    settled: 0,
    noise: "",
  }));

  useEffect(() => {
    if (reduce) return;
    // A timer rather than requestAnimationFrame, so a tab opened in the background still settles.
    const start = performance.now() + delay;
    const tick = () => {
      const t = Math.min(Math.max((performance.now() - start) / duration, 0), 1);
      const settled = Math.floor(t * text.length);
      let noise = "";
      for (let i = settled; i < text.length; i++) {
        noise += text[i] === " " ? " " : GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
      }
      setFrame({ text, settled, noise });
      if (t >= 1) window.clearInterval(id);
    };
    const id = window.setInterval(tick, 40);
    return () => window.clearInterval(id);
  }, [text, duration, delay, reduce]);

  const done = reduce || frame.text !== text || frame.settled >= text.length;
  return (
    <span className={cn("inline", className)} aria-label={text}>
      {done ? (
        <span aria-hidden>{text}</span>
      ) : (
        <span aria-hidden>
          {text.slice(0, frame.settled)}
          <span className="opacity-30">{frame.noise}</span>
        </span>
      )}
    </span>
  );
}

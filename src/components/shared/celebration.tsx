"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";

const EVENT = "roommate:celebrate";
const COLORS = ["#34d399", "#6ee7b7", "#a3e635", "#2dd4bf", "#fcd34d", "#f0fdf4"];

interface Particle {
  x: number;
  y: number;
  rotate: number;
  delay: number;
  color: string;
  round: boolean;
}

interface Celebration {
  id: number;
  title: string;
  subtitle?: string;
  priority: number;
  particles: Particle[];
}

interface CelebrateOptions {
  subtitle?: string;
  /** A higher-priority celebration replaces a lower one that is still on screen, never the reverse. */
  priority?: number;
}

/** Fire a short checkmark + confetti burst from anywhere in the app. */
export function celebrate(title: string, options: CelebrateOptions = {}) {
  window.dispatchEvent(new CustomEvent<{ title: string } & CelebrateOptions>(EVENT, { detail: { title, ...options } }));
}

function makeParticles(count: number): Particle[] {
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
    const distance = 70 + Math.random() * 70;
    return {
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance * 0.75 - 20,
      rotate: Math.random() * 360 - 180,
      delay: Math.random() * 0.08,
      color: COLORS[i % COLORS.length],
      round: i % 3 === 0,
    };
  });
}

export function CelebrationLayer() {
  const [current, setCurrent] = useState<Celebration | null>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onCelebrate = (event: Event) => {
      const { title, subtitle, priority = 0 } = (event as CustomEvent<{ title: string } & CelebrateOptions>).detail;
      setCurrent((prev) =>
        prev && prev.priority > priority ? prev : { id: Date.now(), title, subtitle, priority, particles: makeParticles(reduce ? 0 : 22) },
      );
      clearTimeout(timer);
      timer = setTimeout(() => setCurrent(null), 1900);
    };
    window.addEventListener(EVENT, onCelebrate);
    return () => {
      window.removeEventListener(EVENT, onCelebrate);
      clearTimeout(timer);
    };
  }, [reduce]);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-[34%] z-[60] flex justify-center" aria-live="polite">
      <AnimatePresence>
        {current ? (
          <motion.div
            key={current.id}
            role="status"
            initial={{ opacity: 0, scale: 0.85, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -6 }}
            transition={{ type: "spring", stiffness: 420, damping: 28 }}
            className="relative flex flex-col items-center"
          >
            {current.particles.map((p, i) => (
              <motion.span
                key={i}
                className="absolute top-8 left-1/2 block"
                style={{ width: p.round ? 7 : 6, height: p.round ? 7 : 11, background: p.color, borderRadius: p.round ? 999 : 2 }}
                initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 0.6 }}
                animate={{ x: p.x, y: [0, p.y, p.y + 40], opacity: [1, 1, 0], rotate: p.rotate, scale: 1 }}
                transition={{ duration: 1.25, delay: p.delay, ease: [0.16, 1, 0.3, 1], times: [0, 0.55, 1] }}
              />
            ))}
            <span className="relative flex size-16 items-center justify-center rounded-full bg-primary text-primary-foreground glow-primary">
              <svg viewBox="0 0 24 24" className="size-8" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <motion.path d="M5 12.5l4.5 4.5L19 7.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.4, delay: 0.12, ease: "easeOut" }} />
              </svg>
            </span>
            <div className="mt-3 rounded-2xl border border-primary/25 bg-popover/90 px-4 py-2 text-center shadow-2xl shadow-foreground/15 backdrop-blur">
              <p className="font-display text-lg font-medium">{current.title}</p>
              {current.subtitle ? <p className="text-xs text-muted-foreground">{current.subtitle}</p> : null}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

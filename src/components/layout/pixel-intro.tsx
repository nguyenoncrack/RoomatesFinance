"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { Mascot } from "@/components/shared/doodles";
import { Logo } from "@/components/shared/logo";

export const INTRO_KEY = "roommate-finance:intro-shown";
const MIN_SPLASH_MS = 700;
const TICK_MS = 16;
/** Timeline (ms): coarsen the splash, cross over at the peak, sharpen the app, then a soft blur-out. */
const OUT_MS = 520;
const IN_MS = 900;
const SOFTEN_MS = 220;
const PEAK = 34;
const MIN_CELL = 2;

const easeInCubic = (t: number) => t * t * t;
const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

function setCell(size: number) {
  const half = Math.floor(size / 2);
  const flood = document.getElementById("pixelate-flood");
  const tile = document.getElementById("pixelate-tile");
  const dilate = document.getElementById("pixelate-dilate");
  if (!flood || !tile || !dilate) return false;
  flood.setAttribute("x", String(half));
  flood.setAttribute("y", String(half));
  tile.setAttribute("width", String(size));
  tile.setAttribute("height", String(size));
  dilate.setAttribute("radius", String(Math.ceil(size / 2)));
  return true;
}

function shouldPlay() {
  try {
    return window.sessionStorage.getItem(INTRO_KEY) !== "1";
  } catch {
    return false;
  }
}

function markPlayed() {
  try {
    window.sessionStorage.setItem(INTRO_KEY, "1");
  } catch {
    // Storage blocked: the intro just won't be skipped next time.
  }
}

/**
 * Once per sign-in: a loading splash that dissolves through a pixel mosaic into the app, which
 * then sharpens from blocky to clear. It pixelates the real page (via the #pixelate SVG filter on
 * `target`), not a picture of it. Skipped for reduced motion.
 */
export function PixelIntro({ ready, target }: { ready: boolean; target: RefObject<HTMLElement | null> }) {
  // `active` drives the timeline; `splash` only toggles the overlay, so hiding it mid-way doesn't
  // restart or cancel the effect below.
  const [active, setActive] = useState(false);
  const [splash, setSplash] = useState(false);
  const started = useRef(0);
  const splashRef = useRef<HTMLDivElement>(null);

  // Decide on mount whether to play; this reads sessionStorage, which only exists in the browser.
  useEffect(() => {
    if (!shouldPlay()) return;
    started.current = performance.now();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActive(true);
    setSplash(true);
  }, []);

  useEffect(() => {
    if (!active || !ready) return;
    const el = target.current;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timers: number[] = [];
    const finish = () => {
      if (el) el.style.filter = "";
      markPlayed();
      setSplash(false);
      setActive(false);
    };
    const wait = Math.max(0, MIN_SPLASH_MS - (performance.now() - started.current));

    if (reduce || !el || !setCell(MIN_CELL)) {
      timers.push(window.setTimeout(finish, wait));
      return () => timers.forEach(clearTimeout);
    }

    // One clock drives everything (a timer, not rAF, so it still completes in a background tab).
    // Cell size follows eased curves and only touches the DOM when the rounded size changes.
    let begin = 0;
    let lastCell = -1;
    let crossed = false;
    const tick = () => {
      const t = performance.now() - begin;
      const overlay = splashRef.current;
      if (t < OUT_MS) {
        const p = t / OUT_MS;
        const cell = Math.round(MIN_CELL + (PEAK - MIN_CELL) * easeInCubic(p));
        if (cell !== lastCell) setCell((lastCell = cell));
        // Fade the splash over the last stretch so the swap at the peak isn't a hard cut.
        if (overlay) overlay.style.opacity = String(p < 0.6 ? 1 : 1 - (p - 0.6) / 0.4);
        return;
      }
      if (!crossed) {
        crossed = true;
        setSplash(false);
      }
      if (t < OUT_MS + IN_MS) {
        const p = (t - OUT_MS) / IN_MS;
        const cell = Math.max(MIN_CELL, Math.round(PEAK - (PEAK - MIN_CELL) * easeOutCubic(p)));
        if (cell !== lastCell) setCell((lastCell = cell));
        return;
      }
      if (t < OUT_MS + IN_MS + SOFTEN_MS) {
        // Last few pixels melt into a quick blur instead of snapping to sharp.
        const p = (t - OUT_MS - IN_MS) / SOFTEN_MS;
        el.style.filter = `blur(${(1.2 * (1 - p)).toFixed(2)}px)`;
        return;
      }
      window.clearInterval(clock);
      finish();
    };
    let clock = 0;
    timers.push(
      window.setTimeout(() => {
        el.style.filter = "url(#pixelate)";
        begin = performance.now();
        clock = window.setInterval(tick, TICK_MS);
      }, wait),
    );
    return () => {
      timers.forEach(clearTimeout);
      window.clearInterval(clock);
      if (el) el.style.filter = "";
    };
  }, [active, ready, target]);

  if (!splash) return null;
  return (
    <div
      ref={splashRef}
      className="fixed inset-0 z-[100] grid place-items-center bg-background"
      role="status"
      aria-label="Loading your household"
    >
      <div className="pointer-events-none absolute inset-0 bg-[image:var(--texture-plaster)] bg-[length:260px_260px] opacity-30 mix-blend-multiply" aria-hidden />
      <div className="relative flex flex-col items-center gap-5">
        <Mascot mood="happy" className="h-36 animate-bob" />
        <div className="scale-125">
          <Logo />
        </div>
        <p className="font-hand text-xl text-muted-foreground">
          loading<span className="inline-block animate-pulse">…</span>
        </p>
      </div>
    </div>
  );
}

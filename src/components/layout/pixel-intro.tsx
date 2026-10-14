"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { Mascot } from "@/components/shared/doodles";
import { Logo } from "@/components/shared/logo";

export const INTRO_KEY = "roommate-finance:intro-shown";
const MIN_SPLASH_MS = 700;
const STEP_MS = 70;
/** Mosaic cell sizes: coarsen the splash, swap to the app at the peak, then sharpen to clear. */
const OUT = [3, 6, 12, 22, 36];
const IN = [36, 26, 18, 12, 8, 5, 3];

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

    if (reduce || !el || !setCell(OUT[0])) {
      timers.push(window.setTimeout(finish, wait));
      return () => timers.forEach(clearTimeout);
    }

    timers.push(
      window.setTimeout(() => {
        el.style.filter = "url(#pixelate)";
        OUT.forEach((size, i) => timers.push(window.setTimeout(() => setCell(size), i * STEP_MS)));
        // At the coarsest point the splash disappears, so the app emerges from the mosaic.
        timers.push(
          window.setTimeout(() => {
            setSplash(false);
            IN.forEach((size, i) => timers.push(window.setTimeout(() => setCell(size), i * STEP_MS)));
            timers.push(window.setTimeout(finish, IN.length * STEP_MS));
          }, OUT.length * STEP_MS),
        );
      }, wait),
    );
    return () => {
      timers.forEach(clearTimeout);
      if (el) el.style.filter = "";
    };
  }, [active, ready, target]);

  if (!splash) return null;
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-background" role="status" aria-label="Loading your household">
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

"use client";

import { useEffect, useRef } from "react";

const LIFE_MS = 1400;
const FADE_MS = 900;
const COLOR = "32, 30, 26";

interface Pt {
  x: number;
  y: number;
}
interface Stroke {
  pts: Pt[];
  /** When the pencil was lifted; null while still drawing. */
  ended: number | null;
  last: number;
}

/** Hold the left mouse button and move to scribble with the pencil. Lines fade away after a moment. */
export function PencilDraw() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const strokes: Stroke[] = [];
    let current: Stroke | null = null;
    let timer = 0;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(window.innerWidth * dpr);
      canvas.height = Math.round(window.innerHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const alpha = (s: Stroke, now: number) => {
      const age = now - (s.ended ?? s.last);
      return age <= LIFE_MS ? 1 : Math.max(0, 1 - (age - LIFE_MS) / FADE_MS);
    };

    const draw = () => {
      timer = 0;
      const now = performance.now();
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      for (let i = strokes.length - 1; i >= 0; i--) {
        const s = strokes[i];
        const a = alpha(s, now);
        if (a <= 0) {
          strokes.splice(i, 1);
          continue;
        }
        ctx.strokeStyle = `rgba(${COLOR}, ${0.85 * a})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        s.pts.forEach((p, j) => {
          if (j === 0) ctx.moveTo(p.x, p.y);
          else {
            const q = s.pts[j - 1];
            ctx.quadraticCurveTo(q.x, q.y, (q.x + p.x) / 2, (q.y + p.y) / 2);
          }
        });
        if (s.pts.length === 1) ctx.lineTo(s.pts[0].x + 0.1, s.pts[0].y);
        ctx.stroke();
      }
      if (strokes.length) timer = window.setTimeout(draw, 16);
    };
    const kick = () => {
      if (!timer) timer = window.setTimeout(draw, 0);
    };

    const skip = (t: EventTarget | null) =>
      t instanceof Element && Boolean(t.closest("input, textarea, select, [contenteditable='true'], [role='slider'], iframe"));

    const down = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || e.button !== 0 || skip(e.target)) return;
      current = { pts: [{ x: e.clientX, y: e.clientY }], ended: null, last: performance.now() };
      strokes.push(current);
      kick();
    };
    const move = (e: PointerEvent) => {
      if (!current) return;
      if (!(e.buttons & 1)) {
        current.ended = performance.now();
        current = null;
        return;
      }
      current.pts.push({ x: e.clientX, y: e.clientY });
      current.last = performance.now();
      kick();
    };
    const up = () => {
      if (current) current.ended = performance.now();
      current = null;
      kick();
    };

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("pointerdown", down, true);
    window.addEventListener("pointermove", move, true);
    window.addEventListener("pointerup", up, true);
    window.addEventListener("pointercancel", up, true);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointerdown", down, true);
      window.removeEventListener("pointermove", move, true);
      window.removeEventListener("pointerup", up, true);
      window.removeEventListener("pointercancel", up, true);
    };
  }, []);

  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 z-[9999] h-screen w-screen" />;
}

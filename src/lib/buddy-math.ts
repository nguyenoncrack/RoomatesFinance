/** Small pure helpers behind the roaming buddy's movement, kept separate so they can be unit tested. */

export interface Point {
  x: number;
  y: number;
}

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
export const easeInCubic = (t: number) => t * t * t;

/** A point partway through a jump: x eases, y goes straight, and a parabola of height `lift` is added on top. */
export function arcPoint(from: Point, to: Point, t: number, lift: number): Point {
  const p = clamp(t, 0, 1);
  return { x: lerp(from.x, to.x, easeInOut(p)), y: lerp(from.y, to.y, p) - 4 * lift * p * (1 - p) };
}

/** Picks an item by weight. `r` is a random number in [0, 1). */
export function pickWeighted<T>(items: { w: number; v: T }[], r: number): T {
  const total = items.reduce((a, i) => a + i.w, 0);
  let acc = r * total;
  for (const item of items) {
    acc -= item.w;
    if (acc < 0) return item.v;
  }
  return items[items.length - 1].v;
}

/**
 * The stretch of a ledge he's allowed to walk on: the ledge shrunk by `pad` on both sides, then limited to
 * `[min, max]`. Null when what's left is too short to bother with.
 */
export function walkSpan(left: number, right: number, pad: number, min: number, max: number, minLength = 28): { start: number; end: number } | null {
  const start = Math.max(left + pad, min);
  const end = Math.min(right - pad, max);
  return end - start >= minLength ? { start, end } : null;
}

export function randomBetween(lo: number, hi: number, r = Math.random()) {
  return lo + (hi - lo) * r;
}

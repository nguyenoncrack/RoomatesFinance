import { describe, expect, it } from "vitest";
import { arcPoint, clamp, easeInOut, pickWeighted, walkSpan } from "../buddy-math";

describe("arcPoint", () => {
  const from = { x: 0, y: 100 };
  const to = { x: 200, y: 160 };

  it("starts and ends exactly on the two ledges", () => {
    expect(arcPoint(from, to, 0, 40)).toEqual(from);
    expect(arcPoint(from, to, 1, 40)).toEqual(to);
  });

  it("rises above the straight line in the middle by the lift", () => {
    const mid = arcPoint(from, to, 0.5, 40);
    expect(mid.y).toBeCloseTo(130 - 40);
    expect(mid.x).toBeCloseTo(100);
  });

  it("clamps progress outside 0..1", () => {
    expect(arcPoint(from, to, -1, 40)).toEqual(from);
    expect(arcPoint(from, to, 2, 40)).toEqual(to);
  });
});

describe("easeInOut", () => {
  it("is monotonic from 0 to 1", () => {
    let prev = -1;
    for (let t = 0; t <= 1; t += 0.05) {
      const v = easeInOut(t);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
    expect(easeInOut(0)).toBe(0);
    expect(easeInOut(1)).toBe(1);
  });
});

describe("pickWeighted", () => {
  const items = [
    { w: 1, v: "a" },
    { w: 3, v: "b" },
    { w: 0, v: "never" },
    { w: 6, v: "c" },
  ];

  it("maps the random range onto the weights in order", () => {
    expect(pickWeighted(items, 0)).toBe("a");
    expect(pickWeighted(items, 0.09)).toBe("a");
    expect(pickWeighted(items, 0.1)).toBe("b");
    expect(pickWeighted(items, 0.39)).toBe("b");
    expect(pickWeighted(items, 0.4)).toBe("c");
    expect(pickWeighted(items, 0.999)).toBe("c");
  });

  it("never returns a zero-weight item", () => {
    for (let r = 0; r < 1; r += 0.01) expect(pickWeighted(items, r)).not.toBe("never");
  });
});

describe("walkSpan", () => {
  it("shrinks the ledge by the padding", () => {
    expect(walkSpan(100, 500, 22, 0, 1000)).toEqual({ start: 122, end: 478 });
  });

  it("is limited by the allowed window (sidebar on the left, small area on phones)", () => {
    expect(walkSpan(0, 800, 20, 270, 400)).toEqual({ start: 270, end: 400 });
  });

  it("returns null when too little is left", () => {
    expect(walkSpan(100, 140, 22, 0, 1000)).toBeNull();
    expect(walkSpan(0, 300, 10, 290, 295)).toBeNull();
  });
});

describe("clamp", () => {
  it("limits a value to a range", () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-5, 0, 3)).toBe(0);
    expect(clamp(2, 0, 3)).toBe(2);
  });
});

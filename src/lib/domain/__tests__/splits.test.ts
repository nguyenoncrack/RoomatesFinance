import { describe, expect, it } from "vitest";
import { allocateProportionally, computeSplit, validateSplits } from "../splits";

const people = ["alex", "ben", "chris"];
const shareMap = (r: ReturnType<typeof computeSplit>) => {
  if (!r.ok) throw new Error(r.error);
  return Object.fromEntries(r.splits.map((s) => [s.userId, s.shareCents]));
};

describe("allocateProportionally", () => {
  it("always sums to the total", () => {
    for (const total of [1, 2, 99, 100, 101, 1000, 12345, 99999]) {
      for (const weights of [[1, 1, 1], [2, 1, 1], [3, 7], [1, 1, 1, 1, 1, 1, 1], [5000, 3333, 1667]]) {
        const shares = allocateProportionally(total, weights);
        expect(shares.reduce((a, b) => a + b, 0)).toBe(total);
        shares.forEach((s) => expect(Number.isInteger(s)).toBe(true));
      }
    }
  });

  it("gives leftover cents to earlier participants on ties (deterministic)", () => {
    expect(allocateProportionally(100, [1, 1, 1])).toEqual([34, 33, 33]);
    expect(allocateProportionally(101, [1, 1, 1])).toEqual([34, 34, 33]);
  });

  it("gives leftovers to the largest fractional remainder first", () => {
    // 10 * 2/3 = 6.67, 10 * 1/3 = 3.33 -> floors 6 + 3, leftover goes to the 0.67
    expect(allocateProportionally(10, [2, 1])).toEqual([7, 3]);
  });

  it("supports zero weights", () => {
    expect(allocateProportionally(500, [0, 1, 0])).toEqual([0, 500, 0]);
  });

  it("rejects bad input", () => {
    expect(() => allocateProportionally(100, [])).toThrow();
    expect(() => allocateProportionally(100, [0, 0])).toThrow();
    expect(() => allocateProportionally(-1, [1])).toThrow();
    expect(() => allocateProportionally(100, [1.5])).toThrow();
  });
});

describe("computeSplit — equal", () => {
  it("splits $120 three ways", () => {
    expect(shareMap(computeSplit({ method: "equal", totalCents: 12000, participants: people }))).toEqual({
      alex: 4000,
      ben: 4000,
      chris: 4000,
    });
  });

  it("handles uneven totals by distributing remainder cents", () => {
    expect(shareMap(computeSplit({ method: "equal", totalCents: 1000, participants: people }))).toEqual({
      alex: 334,
      ben: 333,
      chris: 333,
    });
  });

  it("supports a subset of roommates", () => {
    expect(shareMap(computeSplit({ method: "equal", totalCents: 5001, participants: ["ben", "chris"] }))).toEqual({
      ben: 2501,
      chris: 2500,
    });
  });

  it("rejects zero, negative, fractional amounts and empty participants", () => {
    expect(computeSplit({ method: "equal", totalCents: 0, participants: people }).ok).toBe(false);
    expect(computeSplit({ method: "equal", totalCents: -500, participants: people }).ok).toBe(false);
    expect(computeSplit({ method: "equal", totalCents: 10.5, participants: people }).ok).toBe(false);
    expect(computeSplit({ method: "equal", totalCents: 500, participants: [] }).ok).toBe(false);
    expect(computeSplit({ method: "equal", totalCents: 500, participants: ["a", "a"] }).ok).toBe(false);
  });
});

describe("computeSplit — custom", () => {
  it("accepts amounts that add up", () => {
    const r = computeSplit({ method: "custom", totalCents: 9000, participants: people, values: { alex: 5000, ben: 2500, chris: 1500 } });
    expect(shareMap(r)).toEqual({ alex: 5000, ben: 2500, chris: 1500 });
  });

  it("reports remaining cents when short or over", () => {
    const short = computeSplit({ method: "custom", totalCents: 9000, participants: people, values: { alex: 5000 } });
    expect(short).toMatchObject({ ok: false, remainingCents: 4000 });
    const over = computeSplit({ method: "custom", totalCents: 9000, participants: people, values: { alex: 9000, ben: 1 } });
    expect(over).toMatchObject({ ok: false, remainingCents: -1 });
  });

  it("rejects negative custom amounts", () => {
    const r = computeSplit({ method: "custom", totalCents: 1000, participants: ["alex", "ben"], values: { alex: 1500, ben: -500 } });
    expect(r.ok).toBe(false);
  });
});

describe("computeSplit — percentage", () => {
  it("requires exactly 100%", () => {
    const r = computeSplit({ method: "percentage", totalCents: 10000, participants: people, values: { alex: 5000, ben: 3000, chris: 1000 } });
    expect(r).toMatchObject({ ok: false, remainingBp: 1000 });
    expect(!r.ok && r.error).toContain("90%");
  });

  it("splits by percentage with exact cent totals", () => {
    const r = computeSplit({ method: "percentage", totalCents: 1000, participants: people, values: { alex: 3333, ben: 3333, chris: 3334 } });
    const m = shareMap(r);
    expect(m.alex + m.ben + m.chris).toBe(1000);
    expect(m).toEqual({ alex: 333, ben: 333, chris: 334 });
  });

  it("supports a 0% participant", () => {
    const m = shareMap(computeSplit({ method: "percentage", totalCents: 2000, participants: people, values: { alex: 10000, ben: 0, chris: 0 } }));
    expect(m).toEqual({ alex: 2000, ben: 0, chris: 0 });
  });
});

describe("computeSplit — shares", () => {
  it("splits 2:1:1", () => {
    expect(shareMap(computeSplit({ method: "shares", totalCents: 10000, participants: people, values: { alex: 2, ben: 1, chris: 1 } }))).toEqual({
      alex: 5000,
      ben: 2500,
      chris: 2500,
    });
  });

  it("rounds uneven weighted splits deterministically", () => {
    const m = shareMap(computeSplit({ method: "shares", totalCents: 1001, participants: people, values: { alex: 2, ben: 1, chris: 1 } }));
    expect(m).toEqual({ alex: 501, ben: 250, chris: 250 });
  });

  it("rejects all-zero or fractional weights", () => {
    expect(computeSplit({ method: "shares", totalCents: 100, participants: people, values: {} }).ok).toBe(false);
    expect(computeSplit({ method: "shares", totalCents: 100, participants: people, values: { alex: 1.5 } }).ok).toBe(false);
  });
});

describe("validateSplits", () => {
  it("accepts consistent splits and rejects inconsistent ones", () => {
    expect(validateSplits(100, [{ userId: "a", shareCents: 100, weight: null }])).toBeNull();
    expect(validateSplits(100, [{ userId: "a", shareCents: 99, weight: null }])).not.toBeNull();
    expect(validateSplits(100, [{ userId: "a", shareCents: 150, weight: null }, { userId: "b", shareCents: -50, weight: null }])).not.toBeNull();
    expect(validateSplits(-100, [{ userId: "a", shareCents: -100, weight: null }])).not.toBeNull();
    expect(validateSplits(100, [])).not.toBeNull();
  });
});

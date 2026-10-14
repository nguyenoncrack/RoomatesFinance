import { MAX_AMOUNT_CENTS, sumCents } from "./money";
import type { Cents, ExpenseSplit, SplitMethod } from "./types";

/** 100% expressed in basis points; percentages are stored as integers to avoid float drift. */
export const FULL_PERCENT_BP = 10_000;
const MAX_WEIGHT = 1_000_000;

export interface SplitInput {
  method: SplitMethod;
  totalCents: Cents;
  /** Ordered participant ids. Order is the deterministic tie-breaker for leftover cents. */
  participants: string[];
  /**
   * Per-participant values, meaning depends on method:
   * - equal: ignored
   * - custom: share in cents
   * - percentage: basis points (2500 = 25%)
   * - shares: positive integer weight
   */
  values?: Record<string, number>;
}

export type SplitResult =
  | { ok: true; splits: ExpenseSplit[] }
  | { ok: false; error: string; /** total - allocated, for live "remaining" hints */ remainingCents?: Cents; remainingBp?: number };

/**
 * Largest-remainder allocation: floors every proportional share, then hands the leftover
 * cents one at a time to the largest fractional remainders (ties go to earlier participants).
 * Always returns integers that sum exactly to `total`.
 */
export function allocateProportionally(total: Cents, weights: number[]): Cents[] {
  if (!Number.isSafeInteger(total) || total < 0) throw new Error("total must be non-negative integer cents");
  if (weights.length === 0) throw new Error("at least one weight is required");
  for (const w of weights) {
    if (!Number.isSafeInteger(w) || w < 0) throw new Error("weights must be non-negative integers");
  }
  const weightSum = weights.reduce((a, b) => a + b, 0);
  if (weightSum <= 0) throw new Error("weights must not all be zero");

  const base: Cents[] = [];
  const remainders: { index: number; remainder: number }[] = [];
  let allocated = 0;
  weights.forEach((w, index) => {
    const numerator = total * w;
    const share = Math.floor(numerator / weightSum);
    base.push(share);
    allocated += share;
    remainders.push({ index, remainder: numerator - share * weightSum });
  });

  let leftover = total - allocated;
  remainders.sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (let i = 0; leftover > 0; i++, leftover--) {
    base[remainders[i % remainders.length].index] += 1;
  }
  return base;
}

function validateCommon(input: SplitInput): string | null {
  const { totalCents, participants } = input;
  if (!Number.isSafeInteger(totalCents)) return "Amount must be a whole number of cents.";
  if (totalCents <= 0) return "Amount must be greater than zero.";
  if (totalCents > MAX_AMOUNT_CENTS) return "Amount is too large.";
  if (participants.length === 0) return "Pick at least one roommate to split with.";
  if (new Set(participants).size !== participants.length) return "Each roommate can only appear once.";
  return null;
}

export function computeSplit(input: SplitInput): SplitResult {
  const commonError = validateCommon(input);
  if (commonError) return { ok: false, error: commonError };

  const { method, totalCents, participants } = input;
  const values = input.values ?? {};
  const valueOf = (id: string) => values[id] ?? 0;

  switch (method) {
    case "equal": {
      const shares = allocateProportionally(totalCents, participants.map(() => 1));
      return {
        ok: true,
        splits: participants.map((userId, i) => ({ userId, shareCents: shares[i], weight: null })),
      };
    }
    case "custom": {
      for (const id of participants) {
        const v = valueOf(id);
        if (!Number.isSafeInteger(v) || v < 0) return { ok: false, error: "Custom amounts can't be negative." };
      }
      const assigned = sumCents(participants.map(valueOf));
      if (assigned !== totalCents) {
        return {
          ok: false,
          error: assigned < totalCents ? "Custom amounts don't add up to the total yet." : "Custom amounts exceed the total.",
          remainingCents: totalCents - assigned,
        };
      }
      return {
        ok: true,
        splits: participants.map((userId) => ({ userId, shareCents: valueOf(userId), weight: valueOf(userId) })),
      };
    }
    case "percentage": {
      for (const id of participants) {
        const v = valueOf(id);
        if (!Number.isSafeInteger(v) || v < 0 || v > FULL_PERCENT_BP) {
          return { ok: false, error: "Each percentage must be between 0% and 100%." };
        }
      }
      const totalBp = participants.reduce((acc, id) => acc + valueOf(id), 0);
      if (totalBp !== FULL_PERCENT_BP) {
        return {
          ok: false,
          error: `Percentages must total 100% (currently ${(totalBp / 100).toFixed(2).replace(/\.00$/, "")}%).`,
          remainingBp: FULL_PERCENT_BP - totalBp,
        };
      }
      const shares = allocateProportionally(totalCents, participants.map(valueOf));
      return {
        ok: true,
        splits: participants.map((userId, i) => ({ userId, shareCents: shares[i], weight: valueOf(userId) })),
      };
    }
    case "shares": {
      for (const id of participants) {
        const v = valueOf(id);
        if (!Number.isSafeInteger(v) || v < 0 || v > MAX_WEIGHT) {
          return { ok: false, error: "Shares must be whole numbers of 0 or more." };
        }
      }
      if (participants.every((id) => valueOf(id) === 0)) {
        return { ok: false, error: "At least one roommate needs a share greater than zero." };
      }
      const shares = allocateProportionally(totalCents, participants.map(valueOf));
      return {
        ok: true,
        splits: participants.map((userId, i) => ({ userId, shareCents: shares[i], weight: valueOf(userId) })),
      };
    }
  }
}

/** Server/storage-side integrity check that applies regardless of split method. */
export function validateSplits(totalCents: Cents, splits: ExpenseSplit[]): string | null {
  if (!Number.isSafeInteger(totalCents) || totalCents <= 0) return "Amount must be a positive number of cents.";
  if (splits.length === 0) return "An expense needs at least one participant.";
  const ids = new Set<string>();
  for (const s of splits) {
    if (ids.has(s.userId)) return "Duplicate participant in split.";
    ids.add(s.userId);
    if (!Number.isSafeInteger(s.shareCents) || s.shareCents < 0) return "Shares must be non-negative cents.";
  }
  if (sumCents(splits.map((s) => s.shareCents)) !== totalCents) return "Shares must add up to the total.";
  return null;
}

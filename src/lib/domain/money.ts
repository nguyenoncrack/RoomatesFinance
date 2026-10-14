import type { Cents } from "./types";

export const MAX_AMOUNT_CENTS = 10_000_000_00; // $10M ceiling keeps us far from float-safe limits

/**
 * Parses user input like "12", "12.5", "$1,234.56" into integer cents.
 * Returns null for anything that isn't a non-negative amount with at most 2 decimals.
 */
export function parseCents(input: string): Cents | null {
  const cleaned = input.trim().replace(/[$,\s]/g, "");
  const match = /^(\d*)(?:\.(\d{0,2}))?$/.exec(cleaned);
  if (!match) return null;
  const dollars = match[1];
  const fraction = match[2] ?? "";
  if (dollars === "" && fraction === "") return null;
  const cents = Number(dollars || "0") * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents) || cents > MAX_AMOUNT_CENTS) return null;
  return cents;
}

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

export function formatCents(cents: Cents, opts: { signed?: boolean } = {}): string {
  const abs = usd.format(Math.abs(cents) / 100);
  if (cents < 0) return `-${abs}`;
  if (opts.signed && cents > 0) return `+${abs}`;
  return abs;
}

/** Plain decimal string for prefilling inputs: 1234 -> "12.34". */
export function centsToInput(cents: Cents): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

export function sumCents(values: Iterable<Cents>): Cents {
  let total = 0;
  for (const v of values) total += v;
  return total;
}

export function assertCents(value: number, label = "amount"): asserts value is Cents {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${label} must be an integer number of cents`);
  }
}

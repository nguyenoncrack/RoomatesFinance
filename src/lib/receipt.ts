import { format } from "date-fns";
import { spendingThisMonth } from "@/lib/analytics";
import { formatCents } from "@/lib/domain/money";
import type { HouseholdSnapshot } from "@/lib/domain/types";
import type { Ledger } from "@/lib/ledger";

export interface ReceiptLine {
  label: string;
  value: string;
  tone?: "positive" | "negative";
}

export interface ReceiptTransfer {
  text: string;
  amount: string;
  /** Involves the person the receipt is for. */
  mine: boolean;
}

export interface ReceiptData {
  householdName: string;
  firstName: string;
  dateLabel: string;
  timeLabel: string;
  receiptNo: string;
  lines: ReceiptLine[];
  transfers: ReceiptTransfer[];
  /** Transfers beyond the ones shown. */
  moreTransfers: number;
  netCents: number;
  netLabel: string;
  /** Bar widths (1–3) for the decorative barcode. */
  bars: number[];
}

const MAX_TRANSFERS = 3;

/** Small deterministic hash so the barcode is stable for the same household, person, day and balance. */
function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function barcodeFor(seed: string, count = 30): number[] {
  let state = hash(seed) || 1;
  const bars: number[] = [];
  for (let i = 0; i < count; i++) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    bars.push(1 + (state >>> 24) % 3);
  }
  return bars;
}

/**
 * Everything printed on the receipt, taken from the real ledger at the moment of printing: your balance, what
 * you owe and are owed, this month's spending, how much of your share you've covered, and who pays whom.
 */
export function buildReceipt(
  snapshot: HouseholdSnapshot,
  ledger: Ledger,
  user: { id: string; displayName: string },
  now: Date = new Date(),
): ReceiptData {
  const net = ledger.balances.get(user.id) ?? 0;
  const name = (id: string) => (id === user.id ? "You" : (ledger.shortName.get(id) ?? "Former roommate"));

  const iOwe = ledger.simplified.filter((t) => t.from === user.id).reduce((a, t) => a + t.amountCents, 0);
  const owedToMe = ledger.simplified.filter((t) => t.to === user.id).reduce((a, t) => a + t.amountCents, 0);

  const monthKey = format(now, "yyyy-MM");
  const monthCount = snapshot.expenses.filter((e) => e.expenseDate.slice(0, 7) === monthKey).length;
  const monthTotal = spendingThisMonth(snapshot.expenses, now);

  const mine = ledger.summaries.find((s) => s.userId === user.id);
  const share = mine?.shareCents ?? 0;
  const coverage = share > 0 ? Math.min(1, Math.max(0, 1 + net / share)) : 1;

  const lines: ReceiptLine[] = [
    { label: "Balance", value: formatCents(net, { signed: true }), tone: net > 0 ? "positive" : net < 0 ? "negative" : undefined },
    { label: "You owe", value: formatCents(iOwe), tone: iOwe > 0 ? "negative" : undefined },
    { label: "Owed to you", value: formatCents(owedToMe), tone: owedToMe > 0 ? "positive" : undefined },
    { label: "This month", value: formatCents(monthTotal) },
    { label: `Expenses (${format(now, "MMM")})`, value: String(monthCount) },
    { label: "Share paid", value: `${Math.round(coverage * 100)}%` },
  ];

  // Payments that involve you come first; if there are none, show the household's biggest ones.
  const all = ledger.simplified.map((t) => ({ t, mine: t.from === user.id || t.to === user.id }));
  const ordered = [...all].sort((a, b) => Number(b.mine) - Number(a.mine) || b.t.amountCents - a.t.amountCents);
  const transfers = ordered.slice(0, MAX_TRANSFERS).map(({ t, mine: isMine }) => ({
    text: `${name(t.from)} → ${name(t.to)}`,
    amount: formatCents(t.amountCents),
    mine: isMine,
  }));

  return {
    householdName: snapshot.household.name,
    firstName: user.displayName.trim().split(/\s+/)[0] || "friend",
    dateLabel: format(now, "EEE, MMM d, yyyy"),
    timeLabel: format(now, "h:mm a"),
    receiptNo: String(snapshot.expenses.length + snapshot.settlements.length).padStart(4, "0"),
    lines,
    transfers,
    moreTransfers: Math.max(0, ordered.length - transfers.length),
    netCents: net,
    netLabel: net > 0 ? "You're owed" : net < 0 ? "You owe" : "All square",
    bars: barcodeFor(`${snapshot.household.id}|${user.id}|${format(now, "yyyy-MM-dd")}|${net}`),
  };
}

import type { Category, HouseholdSnapshot } from "@/lib/domain/types";

export type TickerTrend = "up" | "down" | "flat";

export type TickerEntry =
  | {
      kind: "expense";
      id: string;
      at: string;
      payerId: string;
      title: string;
      category: Category;
      amountCents: number;
      /** How this expense moved the viewer's net balance; null when the viewer isn't involved. */
      deltaCents: number | null;
      trend: TickerTrend;
    }
  | {
      kind: "settlement";
      id: string;
      at: string;
      fromId: string;
      toId: string;
      amountCents: number;
      pending: boolean;
      trend: TickerTrend;
    };

/**
 * Newest-first market-style ticker of household money movements, seen from `viewerId`.
 * Expenses trend up when they leave the viewer owed money and down when they add to what the viewer owes;
 * completed reimbursements always trend up (a debt got paid back). Voided payments are omitted.
 */
export function buildTicker(snapshot: HouseholdSnapshot, viewerId: string | null, limit = 12): TickerEntry[] {
  const entries: TickerEntry[] = [];
  for (const e of snapshot.expenses) {
    const share = e.splits.find((s) => s.userId === viewerId)?.shareCents ?? 0;
    const involved = viewerId !== null && (e.paidBy === viewerId || share > 0);
    const deltaCents = involved ? (e.paidBy === viewerId ? e.amountCents : 0) - share : null;
    entries.push({
      kind: "expense",
      id: `e:${e.id}`,
      at: e.createdAt,
      payerId: e.paidBy,
      title: e.title,
      category: e.category,
      amountCents: e.amountCents,
      deltaCents,
      trend: deltaCents === null || deltaCents === 0 ? "flat" : deltaCents > 0 ? "up" : "down",
    });
  }
  for (const s of snapshot.settlements) {
    if (s.status === "voided") continue;
    entries.push({
      kind: "settlement",
      id: `s:${s.id}`,
      at: s.createdAt,
      fromId: s.paidBy,
      toId: s.paidTo,
      amountCents: s.amountCents,
      pending: s.status === "pending",
      trend: s.status === "pending" ? "flat" : "up",
    });
  }
  return entries.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}

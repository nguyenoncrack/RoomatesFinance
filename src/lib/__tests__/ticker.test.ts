import { describe, expect, it } from "vitest";
import type { Expense, HouseholdSnapshot, Settlement } from "@/lib/domain/types";
import { buildTicker } from "../ticker";

function expense(id: string, paidBy: string, amountCents: number, shares: Record<string, number>, createdAt: string): Expense {
  return {
    id,
    householdId: "h",
    title: id,
    amountCents,
    paidBy,
    category: "groceries",
    description: null,
    expenseDate: createdAt.slice(0, 10),
    splitMethod: "equal",
    splits: Object.entries(shares).map(([userId, shareCents]) => ({ userId, shareCents, weight: null })),
    receiptUrl: null,
    createdBy: paidBy,
    createdAt,
    updatedAt: createdAt,
  };
}

function settlement(id: string, paidBy: string, paidTo: string, amountCents: number, status: Settlement["status"], createdAt: string): Settlement {
  return { id, householdId: "h", paidBy, paidTo, amountCents, paymentMethod: "venmo", status, note: null, createdBy: paidBy, createdAt, completedAt: null };
}

const snapshot = (expenses: Expense[], settlements: Settlement[] = []) =>
  ({ household: {} as HouseholdSnapshot["household"], members: [], expenses, settlements, recurring: [], audit: [] }) satisfies HouseholdSnapshot;

describe("buildTicker", () => {
  const groceries = expense("groceries", "alex", 12000, { alex: 4000, ben: 4000, chris: 4000 }, "2026-10-01T10:00:00Z");
  const power = expense("power", "ben", 9000, { alex: 3000, ben: 3000, chris: 3000 }, "2026-10-02T10:00:00Z");
  const benOnly = expense("ben-only", "ben", 500, { ben: 500 }, "2026-10-03T10:00:00Z");

  it("reports each expense's effect on the viewer's balance", () => {
    const t = buildTicker(snapshot([groceries, power, benOnly]), "alex");
    const byId = Object.fromEntries(t.map((e) => [e.id, e]));
    expect(byId["e:groceries"]).toMatchObject({ deltaCents: 8000, trend: "up" });
    expect(byId["e:power"]).toMatchObject({ deltaCents: -3000, trend: "down" });
    expect(byId["e:ben-only"]).toMatchObject({ deltaCents: null, trend: "flat" });
  });

  it("credits a payer who isn't part of the split for the full amount", () => {
    const gift = expense("gift", "alex", 2000, { ben: 1000, chris: 1000 }, "2026-10-04T10:00:00Z");
    expect(buildTicker(snapshot([gift]), "alex")[0]).toMatchObject({ deltaCents: 2000, trend: "up" });
  });

  it("sorts newest first, skips voided payments, and marks pending ones flat", () => {
    const t = buildTicker(
      snapshot(
        [groceries],
        [
          settlement("paid", "chris", "alex", 5000, "completed", "2026-10-05T10:00:00Z"),
          settlement("void", "chris", "ben", 2000, "voided", "2026-10-06T10:00:00Z"),
          settlement("pend", "chris", "ben", 2000, "pending", "2026-10-07T10:00:00Z"),
        ],
      ),
      "alex",
    );
    expect(t.map((e) => e.id)).toEqual(["s:pend", "s:paid", "e:groceries"]);
    expect(t[0]).toMatchObject({ pending: true, trend: "flat" });
    expect(t[1]).toMatchObject({ trend: "up", amountCents: 5000 });
  });

  it("respects the limit", () => {
    expect(buildTicker(snapshot([groceries, power, benOnly]), "alex", 2)).toHaveLength(2);
  });
});

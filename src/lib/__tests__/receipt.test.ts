import { describe, expect, it } from "vitest";
import { createDemoState, DEMO_USERS } from "@/lib/data/demo-seed";
import type { HouseholdSnapshot } from "@/lib/domain/types";
import { buildLedger } from "@/lib/ledger";
import { barcodeFor, buildReceipt } from "../receipt";

const NOW = new Date(2026, 9, 14, 18, 36); // Oct 14 2026, 6:36 PM local

function demoSnapshot(): HouseholdSnapshot {
  const s = createDemoState(NOW);
  const householdId = "h-ucsb-apartment";
  const profile = (id: string) => s.profiles.find((p) => p.id === id)!;
  return {
    household: s.households.find((h) => h.id === householdId)!,
    members: s.members
      .filter((m) => m.householdId === householdId)
      .map((m) => ({ ...profile(m.id), role: m.role, joinedAt: m.joinedAt, leftAt: m.leftAt })),
    expenses: s.expenses
      .filter((e) => e.householdId === householdId && e.deletedAt === null)
      .map(({ clientRequestId: _c, deletedAt: _d, deletedBy: _b, ...e }) => e),
    settlements: s.settlements.filter((x) => x.householdId === householdId).map(({ clientRequestId: _c, ...x }) => x),
    recurring: [],
    audit: [],
  };
}

describe("buildReceipt", () => {
  const snapshot = demoSnapshot();
  const ledger = buildLedger(snapshot);
  const alex = { id: DEMO_USERS.alex, displayName: "Alex Rivera" };
  const receipt = buildReceipt(snapshot, ledger, alex, NOW);

  it("prints the household, the person and the date", () => {
    expect(receipt.householdName).toBe("UCSB Apartment");
    expect(receipt.firstName).toBe("Alex");
    expect(receipt.dateLabel).toBe("Wed, Oct 14, 2026");
    expect(receipt.timeLabel).toBe("6:36 PM");
    expect(receipt.receiptNo).toMatch(/^\d{4}$/);
  });

  it("uses the real balance from the ledger", () => {
    const net = ledger.balances.get(alex.id)!;
    expect(receipt.netCents).toBe(net);
    const balanceLine = receipt.lines.find((l) => l.label === "Balance")!;
    expect(balanceLine.value.replace(/[+$,]/g, "").replace("-", "")).toBe((Math.abs(net) / 100).toFixed(2));
    expect(balanceLine.tone).toBe(net < 0 ? "negative" : net > 0 ? "positive" : undefined);
    expect(receipt.netLabel).toBe(net < 0 ? "You owe" : net > 0 ? "You're owed" : "All square");
  });

  it("shows what you owe and are owed from the simplified plan", () => {
    const owe = ledger.simplified.filter((t) => t.from === alex.id).reduce((a, t) => a + t.amountCents, 0);
    const owed = ledger.simplified.filter((t) => t.to === alex.id).reduce((a, t) => a + t.amountCents, 0);
    const fmt = (c: number) => `$${(c / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
    expect(receipt.lines.find((l) => l.label === "You owe")!.value).toBe(fmt(owe));
    expect(receipt.lines.find((l) => l.label === "Owed to you")!.value).toBe(fmt(owed));
  });

  it("lists at most three payments, yours first, and counts the rest", () => {
    expect(receipt.transfers.length).toBeLessThanOrEqual(3);
    expect(receipt.transfers.length + receipt.moreTransfers).toBe(ledger.simplified.length);
    const firstTheirs = receipt.transfers.findIndex((t) => !t.mine);
    if (firstTheirs >= 0) expect(receipt.transfers.slice(firstTheirs).every((t) => !t.mine)).toBe(true);
    expect(receipt.transfers.every((t) => t.text.includes("→"))).toBe(true);
  });

  it("counts this month's expenses", () => {
    const monthKey = "2026-10";
    const count = snapshot.expenses.filter((e) => e.expenseDate.startsWith(monthKey)).length;
    expect(receipt.lines.find((l) => l.label.startsWith("Expenses"))!.value).toBe(String(count));
  });

  it("keeps share paid between 0% and 100%", () => {
    const pct = Number(receipt.lines.find((l) => l.label === "Share paid")!.value.replace("%", ""));
    expect(pct).toBeGreaterThanOrEqual(0);
    expect(pct).toBeLessThanOrEqual(100);
  });

  it("says all square for someone with nothing outstanding", () => {
    const clean: HouseholdSnapshot = { ...snapshot, expenses: [], settlements: [] };
    const r = buildReceipt(clean, buildLedger(clean), alex, NOW);
    expect(r.netCents).toBe(0);
    expect(r.netLabel).toBe("All square");
    expect(r.transfers).toEqual([]);
    expect(r.lines.find((l) => l.label === "Share paid")!.value).toBe("100%");
  });
});

describe("barcodeFor", () => {
  it("is stable for the same seed and different for another", () => {
    expect(barcodeFor("a")).toEqual(barcodeFor("a"));
    expect(barcodeFor("a")).not.toEqual(barcodeFor("b"));
  });

  it("makes the requested number of bars, each 1 to 3 wide", () => {
    const bars = barcodeFor("seed", 24);
    expect(bars).toHaveLength(24);
    expect(bars.every((w) => w >= 1 && w <= 3)).toBe(true);
  });
});

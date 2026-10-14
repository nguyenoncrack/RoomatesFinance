import { describe, expect, it } from "vitest";
import { computeNetBalances, expenseDebts, pairwiseDebts, simplifyDebts, summarizeMembers } from "../balances";
import { computeSplit } from "../splits";
import type { Expense, Settlement, SplitMethod } from "../types";

let seq = 0;
function expense(paidBy: string, amountCents: number, participants: string[], method: SplitMethod = "equal", values?: Record<string, number>) {
  const r = computeSplit({ method, totalCents: amountCents, participants, values });
  if (!r.ok) throw new Error(r.error);
  return { id: `e${++seq}`, paidBy, amountCents, splits: r.splits } satisfies Pick<Expense, "id" | "paidBy" | "amountCents" | "splits">;
}
function settlement(paidBy: string, paidTo: string, amountCents: number, status: Settlement["status"] = "completed") {
  return { paidBy, paidTo, amountCents, status };
}
const members = ["alex", "ben", "chris"];
const obj = (m: Map<string, number>) => Object.fromEntries(m);

describe("spec example", () => {
  const expenses = [expense("alex", 12000, members), expense("ben", 9000, members)];

  it("computes net balances", () => {
    expect(obj(computeNetBalances(members, expenses))).toEqual({ alex: 5000, ben: 2000, chris: -7000 });
  });

  it("simplifies to Chris → Alex $50 and Chris → Ben $20", () => {
    expect(simplifyDebts(computeNetBalances(members, expenses))).toEqual([
      { from: "chris", to: "alex", amountCents: 5000 },
      { from: "chris", to: "ben", amountCents: 2000 },
    ]);
  });

  it("original debts keep per-pair obligations", () => {
    expect(pairwiseDebts(expenses)).toEqual([
      { from: "chris", to: "alex", amountCents: 4000 },
      { from: "chris", to: "ben", amountCents: 3000 },
      { from: "ben", to: "alex", amountCents: 1000 },
    ]);
    expect(expenseDebts(expenses)).toHaveLength(4);
  });
});

describe("computeNetBalances", () => {
  it("sums to zero for random-ish ledgers including rounding", () => {
    const people = ["a", "b", "c", "d", "e"];
    const expenses = [
      expense("a", 1001, people),
      expense("b", 333, ["a", "c"]),
      expense("c", 99999, people, "shares", { a: 3, b: 1, c: 1, d: 2, e: 0 }),
      expense("d", 777, ["a", "b", "c", "d", "e"], "percentage", { a: 1111, b: 2222, c: 3333, d: 3334, e: 0 }),
    ];
    const total = [...computeNetBalances(people, expenses).values()].reduce((x, y) => x + y, 0);
    expect(total).toBe(0);
  });

  it("handles a payer who is not in the split", () => {
    const b = computeNetBalances(members, [expense("alex", 6000, ["ben", "chris"])]);
    expect(obj(b)).toEqual({ alex: 6000, ben: -3000, chris: -3000 });
  });

  it("keeps people who are no longer members if they appear in history", () => {
    const b = computeNetBalances(["alex"], [expense("alex", 2000, ["alex", "former"])]);
    expect(obj(b)).toEqual({ alex: 1000, former: -1000 });
  });

  it("throws if an expense's splits don't sum to its amount", () => {
    expect(() =>
      computeNetBalances(members, [{ id: "bad", paidBy: "alex", amountCents: 100, splits: [{ userId: "ben", shareCents: 90, weight: null }] }]),
    ).toThrow(/unbalanced/);
  });
});

describe("reimbursements", () => {
  const expenses = [expense("alex", 12000, members), expense("ben", 9000, members)];

  it("a full reimbursement settles the pair", () => {
    const b = computeNetBalances(members, expenses, [settlement("chris", "alex", 5000)]);
    expect(obj(b)).toEqual({ alex: 0, ben: 2000, chris: -2000 });
    expect(simplifyDebts(b)).toEqual([{ from: "chris", to: "ben", amountCents: 2000 }]);
  });

  it("supports partial reimbursements", () => {
    const b = computeNetBalances(members, expenses, [settlement("chris", "alex", 1234)]);
    expect(obj(b)).toEqual({ alex: 3766, ben: 2000, chris: -5766 });
  });

  it("ignores pending and voided settlements", () => {
    const b = computeNetBalances(members, expenses, [settlement("chris", "alex", 5000, "pending"), settlement("chris", "ben", 2000, "voided")]);
    expect(obj(b)).toEqual({ alex: 5000, ben: 2000, chris: -7000 });
  });

  it("everything settles to zero after paying the simplified transfers", () => {
    const transfers = simplifyDebts(computeNetBalances(members, expenses));
    const after = computeNetBalances(members, expenses, transfers.map((t) => settlement(t.from, t.to, t.amountCents)));
    expect([...after.values()].every((v) => v === 0)).toBe(true);
    expect(simplifyDebts(after)).toEqual([]);
  });

  it("overpayment flips the direction instead of disappearing", () => {
    const b = computeNetBalances(members, expenses, [settlement("chris", "alex", 6000)]);
    expect(obj(b)).toEqual({ alex: -1000, ben: 2000, chris: -1000 });
  });

  it("pairwise view nets reimbursements within the pair", () => {
    const debts = pairwiseDebts(expenses, [settlement("chris", "alex", 4000)]);
    expect(debts.find((d) => d.from === "chris" && d.to === "alex")).toBeUndefined();
  });
});

describe("simplifyDebts", () => {
  it("is deterministic regardless of input order", () => {
    const a = new Map([["d", -500], ["a", 300], ["c", -500], ["b", 700]]);
    const b = new Map([["b", 700], ["c", -500], ["a", 300], ["d", -500]]);
    expect(simplifyDebts(a)).toEqual(simplifyDebts(b));
    expect(simplifyDebts(a)).toEqual([
      { from: "c", to: "b", amountCents: 500 },
      { from: "d", to: "b", amountCents: 200 },
      { from: "d", to: "a", amountCents: 300 },
    ]);
  });

  it("produces at most n-1 transfers that exactly clear balances", () => {
    const balances = new Map([["a", 4321], ["b", -1000], ["c", -2000], ["d", 1679], ["e", -3000]]);
    const transfers = simplifyDebts(balances);
    expect(transfers.length).toBeLessThanOrEqual(balances.size - 1);
    const check = new Map(balances);
    for (const t of transfers) {
      check.set(t.from, check.get(t.from)! + t.amountCents);
      check.set(t.to, check.get(t.to)! - t.amountCents);
      expect(t.amountCents).toBeGreaterThan(0);
    }
    expect([...check.values()].every((v) => v === 0)).toBe(true);
  });

  it("collapses a debt cycle", () => {
    // a owes b 10, b owes c 10, c owes a 10 -> everyone nets to zero
    const expenses = [expense("b", 1000, ["a"]), expense("c", 1000, ["b"]), expense("a", 1000, ["c"])];
    expect(pairwiseDebts(expenses)).toHaveLength(3);
    expect(simplifyDebts(computeNetBalances(["a", "b", "c"], expenses))).toEqual([]);
  });

  it("returns nothing when all settled", () => {
    expect(simplifyDebts(new Map([["a", 0], ["b", 0]]))).toEqual([]);
  });
});

describe("edits and deletions", () => {
  it("recalculates when an expense is removed or edited", () => {
    const e1 = expense("alex", 12000, members);
    const e2 = expense("ben", 9000, members);
    expect(obj(computeNetBalances(members, [e2]))).toEqual({ alex: -3000, ben: 6000, chris: -3000 });
    const edited = expense("alex", 6000, members);
    expect(obj(computeNetBalances(members, [{ ...edited, id: e1.id }, e2]))).toEqual({ alex: 1000, ben: 4000, chris: -5000 });
  });
});

describe("summarizeMembers", () => {
  it("reports owes/owed/paid/share", () => {
    const s = summarizeMembers(members, [expense("alex", 12000, members), expense("ben", 9000, members)]);
    expect(s.find((m) => m.userId === "chris")).toEqual({ userId: "chris", netCents: -7000, owesCents: 7000, owedCents: 0, paidCents: 0, shareCents: 7000 });
    expect(s.find((m) => m.userId === "alex")).toMatchObject({ owedCents: 5000, paidCents: 12000, shareCents: 7000 });
  });
});

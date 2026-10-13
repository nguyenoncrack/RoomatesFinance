import { format, startOfMonth, subMonths } from "date-fns";
import { CATEGORIES, type Category, type Expense } from "@/lib/domain/types";

export function monthKey(day: string) {
  return day.slice(0, 7);
}

export function spendingThisMonth(expenses: Expense[], now = new Date()) {
  const key = format(now, "yyyy-MM");
  return expenses.filter((e) => monthKey(e.expenseDate) === key).reduce((a, e) => a + e.amountCents, 0);
}

export function monthlyTrend(expenses: Expense[], months = 6, now = new Date()) {
  const buckets = Array.from({ length: months }, (_, i) => {
    const d = startOfMonth(subMonths(now, months - 1 - i));
    return { key: format(d, "yyyy-MM"), label: format(d, "MMM"), cents: 0 };
  });
  const byKey = new Map(buckets.map((b) => [b.key, b]));
  for (const e of expenses) {
    const b = byKey.get(monthKey(e.expenseDate));
    if (b) b.cents += e.amountCents;
  }
  return buckets;
}

export function byCategory(expenses: Expense[], sinceDay?: string) {
  const totals = new Map<Category, number>(CATEGORIES.map((c) => [c, 0]));
  for (const e of expenses) {
    if (sinceDay && e.expenseDate < sinceDay) continue;
    totals.set(e.category, totals.get(e.category)! + e.amountCents);
  }
  return [...totals].filter(([, v]) => v > 0).map(([category, cents]) => ({ category, cents })).sort((a, b) => b.cents - a.cents);
}

export function contributions(expenses: Expense[], sinceDay?: string) {
  const paid = new Map<string, number>();
  const share = new Map<string, number>();
  for (const e of expenses) {
    if (sinceDay && e.expenseDate < sinceDay) continue;
    paid.set(e.paidBy, (paid.get(e.paidBy) ?? 0) + e.amountCents);
    for (const s of e.splits) share.set(s.userId, (share.get(s.userId) ?? 0) + s.shareCents);
  }
  const ids = new Set([...paid.keys(), ...share.keys()]);
  return [...ids].map((userId) => ({ userId, paidCents: paid.get(userId) ?? 0, shareCents: share.get(userId) ?? 0 }));
}

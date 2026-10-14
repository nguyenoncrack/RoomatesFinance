import type { Cents, Expense, Settlement } from "./types";

export type BalanceMap = Map<string, Cents>;

export interface Transfer {
  from: string;
  to: string;
  amountCents: Cents;
}

export interface ExpenseDebt extends Transfer {
  expenseId: string;
}

type BalanceInputExpense = Pick<Expense, "id" | "paidBy" | "amountCents" | "splits">;
type BalanceInputSettlement = Pick<Settlement, "paidBy" | "paidTo" | "amountCents" | "status">;

/**
 * Net balance per person: positive = the household owes them, negative = they owe.
 * 1. credit the payer the full amount, 2. debit each participant their share,
 * 3. completed reimbursements move money from payer's debt to payee's credit.
 * Pending/voided settlements never affect balances.
 */
export function computeNetBalances(
  memberIds: string[],
  expenses: BalanceInputExpense[],
  settlements: BalanceInputSettlement[] = [],
): BalanceMap {
  const balances: BalanceMap = new Map(memberIds.map((id) => [id, 0]));
  const add = (id: string, delta: Cents) => balances.set(id, (balances.get(id) ?? 0) + delta);

  for (const expense of expenses) {
    add(expense.paidBy, expense.amountCents);
    for (const split of expense.splits) add(split.userId, -split.shareCents);
  }
  for (const s of settlements) {
    if (s.status !== "completed") continue;
    add(s.paidBy, s.amountCents);
    add(s.paidTo, -s.amountCents);
  }

  let total = 0;
  for (const v of balances.values()) total += v;
  if (total !== 0) {
    throw new Error(`Ledger is unbalanced by ${total} cents; an expense's splits don't sum to its amount.`);
  }
  return balances;
}

/**
 * Deterministic greedy settlement: repeatedly match the largest debtor with the largest
 * creditor (ties broken by id) and transfer the smaller of the two amounts. Each step zeroes
 * at least one person, so it produces at most n-1 transfers. This removes unnecessary
 * transfers in practice but is not guaranteed to be the global minimum (that's NP-hard).
 */
export function simplifyDebts(balances: BalanceMap): Transfer[] {
  const byAmountThenId = (a: [string, Cents], b: [string, Cents]) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);

  const creditors = [...balances].filter(([, v]) => v > 0).sort(byAmountThenId);
  const debtors = [...balances]
    .filter(([, v]) => v < 0)
    .map(([id, v]) => [id, -v] as [string, Cents])
    .sort(byAmountThenId);

  const transfers: Transfer[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(debtors[i][1], creditors[j][1]);
    if (amount > 0) transfers.push({ from: debtors[i][0], to: creditors[j][0], amountCents: amount });
    debtors[i][1] -= amount;
    creditors[j][1] -= amount;
    if (debtors[i][1] === 0) i++;
    if (creditors[j][1] === 0) j++;
  }
  return transfers;
}

/** Expense-by-expense view: every non-payer participant owes the payer their share. */
export function expenseDebts(expenses: BalanceInputExpense[]): ExpenseDebt[] {
  const debts: ExpenseDebt[] = [];
  for (const e of expenses) {
    for (const s of e.splits) {
      if (s.userId === e.paidBy || s.shareCents === 0) continue;
      debts.push({ expenseId: e.id, from: s.userId, to: e.paidBy, amountCents: s.shareCents });
    }
  }
  return debts;
}

/**
 * "Original debts": who owes whom directly from shared expenses, netted only within each pair
 * (no chaining through third parties), after completed reimbursements between that pair.
 */
export function pairwiseDebts(
  expenses: BalanceInputExpense[],
  settlements: BalanceInputSettlement[] = [],
): Transfer[] {
  const pair = new Map<string, Cents>(); // key "a|b" with a < b; positive = a owes b
  const bump = (from: string, to: string, amount: Cents) => {
    const [a, b] = from < to ? [from, to] : [to, from];
    const key = `${a}|${b}`;
    pair.set(key, (pair.get(key) ?? 0) + (from === a ? amount : -amount));
  };
  for (const d of expenseDebts(expenses)) bump(d.from, d.to, d.amountCents);
  for (const s of settlements) {
    if (s.status === "completed") bump(s.paidTo, s.paidBy, s.amountCents);
  }

  const result: Transfer[] = [];
  for (const [key, amount] of pair) {
    if (amount === 0) continue;
    const [a, b] = key.split("|");
    result.push(amount > 0 ? { from: a, to: b, amountCents: amount } : { from: b, to: a, amountCents: -amount });
  }
  return result.sort((x, y) => y.amountCents - x.amountCents || x.from.localeCompare(y.from) || x.to.localeCompare(y.to));
}

export interface MemberBalance {
  userId: string;
  netCents: Cents;
  owesCents: Cents;
  owedCents: Cents;
  paidCents: Cents;
  shareCents: Cents;
}

export function summarizeMembers(
  memberIds: string[],
  expenses: BalanceInputExpense[],
  settlements: BalanceInputSettlement[] = [],
): MemberBalance[] {
  const net = computeNetBalances(memberIds, expenses, settlements);
  const paid = new Map<string, Cents>();
  const share = new Map<string, Cents>();
  for (const e of expenses) {
    paid.set(e.paidBy, (paid.get(e.paidBy) ?? 0) + e.amountCents);
    for (const s of e.splits) share.set(s.userId, (share.get(s.userId) ?? 0) + s.shareCents);
  }
  return [...net].map(([userId, netCents]) => ({
    userId,
    netCents,
    owesCents: Math.max(-netCents, 0),
    owedCents: Math.max(netCents, 0),
    paidCents: paid.get(userId) ?? 0,
    shareCents: share.get(userId) ?? 0,
  }));
}

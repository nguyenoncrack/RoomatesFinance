import type { Cadence } from "./recurring";

export type Cents = number;

export const CATEGORIES = [
  "groceries",
  "utilities",
  "rent",
  "internet",
  "household_supplies",
  "food",
  "other",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const SPLIT_METHODS = ["equal", "custom", "percentage", "shares"] as const;
export type SplitMethod = (typeof SPLIT_METHODS)[number];

export const PAYMENT_METHODS = ["venmo", "zelle", "cash", "other"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export type SettlementStatus = "pending" | "completed" | "voided";
export type MemberRole = "owner" | "member";

export interface Profile {
  id: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface Member extends Profile {
  role: MemberRole;
  joinedAt: string;
  /** Former members stay in history so their balances never vanish. */
  leftAt: string | null;
}

export interface Household {
  id: string;
  name: string;
  createdBy: string;
  createdAt: string;
  /** Optional settle-up rhythm; null when the household hasn't set one. */
  settleCadence: Cadence | null;
  /** Weekday 0–6 for weekly, day of month 1–28 for monthly. */
  settleDay: number | null;
}

export interface ExpenseSplit {
  userId: string;
  shareCents: Cents;
  /** Raw input for percentage (basis points) / shares (weight) / custom (cents) methods. */
  weight: number | null;
}

export interface Expense {
  id: string;
  householdId: string;
  title: string;
  amountCents: Cents;
  paidBy: string;
  category: Category;
  description: string | null;
  expenseDate: string; // YYYY-MM-DD
  splitMethod: SplitMethod;
  splits: ExpenseSplit[];
  receiptUrl: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/** A template that adds the same expense every week or month. */
export interface RecurringExpense {
  id: string;
  householdId: string;
  title: string;
  amountCents: Cents;
  paidBy: string;
  category: Category;
  description: string | null;
  splitMethod: SplitMethod;
  splits: ExpenseSplit[];
  cadence: Cadence;
  /** Day of month the series started on; monthly repeats clamp to it in short months. */
  anchorDay: number;
  /** Next date (YYYY-MM-DD) an expense will be added. */
  nextDate: string;
  createdBy: string;
  createdAt: string;
}

export interface Settlement {
  id: string;
  householdId: string;
  paidBy: string;
  paidTo: string;
  amountCents: Cents;
  paymentMethod: PaymentMethod;
  status: SettlementStatus;
  note: string | null;
  createdBy: string;
  createdAt: string;
  completedAt: string | null;
}

/** Audit trail entry for changes that don't otherwise show up in the ledger (edits, deletes, joins). */
export interface AuditEvent {
  id: string;
  actorId: string | null;
  entityType: "expense" | "settlement" | "member" | "household";
  entityId: string | null;
  action: string;
  title: string | null;
  amountCents: Cents | null;
  createdAt: string;
}

export interface HouseholdSnapshot {
  household: Household;
  members: Member[];
  expenses: Expense[];
  settlements: Settlement[];
  recurring: RecurringExpense[];
  audit: AuditEvent[];
}

export const CATEGORY_LABELS: Record<Category, string> = {
  groceries: "Groceries",
  utilities: "Utilities",
  rent: "Rent",
  internet: "Internet",
  household_supplies: "Household Supplies",
  food: "Food",
  other: "Other",
};

export const SPLIT_METHOD_LABELS: Record<SplitMethod, string> = {
  equal: "Equal",
  custom: "Custom",
  percentage: "Percent",
  shares: "Shares",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  venmo: "Venmo",
  zelle: "Zelle",
  cash: "Cash",
  other: "Other",
};

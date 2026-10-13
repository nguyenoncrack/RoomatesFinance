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

export interface HouseholdSnapshot {
  household: Household;
  members: Member[];
  expenses: Expense[];
  settlements: Settlement[];
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

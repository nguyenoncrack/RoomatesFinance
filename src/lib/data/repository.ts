import type { Cadence, SettleSchedule } from "@/lib/domain/recurring";
import type {
  Category,
  Cents,
  ExpenseSplit,
  HouseholdSnapshot,
  PaymentMethod,
  AppNotification,
  Profile,
  SplitMethod,
} from "@/lib/domain/types";

export type DataMode = "demo" | "supabase";

export interface HouseholdSummary {
  id: string;
  name: string;
  memberCount: number;
  role: "owner" | "member";
}

export interface ExpenseInput {
  title: string;
  amountCents: Cents;
  paidBy: string;
  category: Category;
  description: string | null;
  expenseDate: string;
  splitMethod: SplitMethod;
  splits: ExpenseSplit[];
  /** undefined = keep existing receipt, null = remove, File = replace. */
  receipt?: File | null;
  clientRequestId: string;
}

/** Starts a repeating series. The first expense is added separately; this schedules the next ones. */
export interface RecurringInput {
  title: string;
  amountCents: Cents;
  paidBy: string;
  category: Category;
  description: string | null;
  splitMethod: SplitMethod;
  splits: ExpenseSplit[];
  cadence: Cadence;
  /** Date of the expense that started the series (YYYY-MM-DD). */
  startDate: string;
}

export interface SettlementInput {
  paidBy: string;
  paidTo: string;
  amountCents: Cents;
  paymentMethod: PaymentMethod;
  status: "pending" | "completed";
  note: string | null;
  clientRequestId: string;
}

export interface InvitePreview {
  householdId: string;
  householdName: string;
  memberCount: number;
  expiresAt: string;
  isValid: boolean;
}

export interface CreatedInvite {
  token: string;
  expiresAt: string;
}

/**
 * Single data-access contract implemented by the localStorage demo store and by Supabase.
 * Implementations must validate membership and amounts themselves (never trust the UI).
 */
export interface Repository {
  readonly mode: DataMode;
  getCurrentUser(): Promise<Profile | null>;
  listHouseholds(): Promise<HouseholdSummary[]>;
  getSnapshot(householdId: string): Promise<HouseholdSnapshot>;

  createHousehold(name: string): Promise<string>;
  renameHousehold(householdId: string, name: string): Promise<void>;
  leaveHousehold(householdId: string): Promise<void>;
  /** Owner-only. Removes another roommate once their balance is settled. History stays. */
  kickMember(householdId: string, userId: string): Promise<void>;
  updateProfile(displayName: string): Promise<void>;
  /**
   * Permanently closes your account and signs you out. Your name on past expenses becomes "Deleted user"
   * and the history stays for your roommates. Fails while you owe or are owed money, or while you're the
   * only owner of a household that still has other roommates.
   */
  deleteOwnAccount(): Promise<void>;

  createExpense(householdId: string, input: ExpenseInput): Promise<string>;
  updateExpense(expenseId: string, input: ExpenseInput, expectedUpdatedAt: string): Promise<void>;
  deleteExpense(expenseId: string): Promise<void>;

  createRecurring(householdId: string, input: RecurringInput): Promise<string>;
  /** Creator, payer or owner only. Already-added expenses stay. */
  stopRecurring(recurringId: string): Promise<void>;
  /** Adds every occurrence due on or before `today` and advances each series. Safe to call repeatedly. */
  runDueRecurring(householdId: string, today: string): Promise<number>;
  /** Owner only. `null` turns the settle day off. */
  setSettleSchedule(householdId: string, schedule: SettleSchedule | null): Promise<void>;

  recordSettlement(householdId: string, input: SettlementInput): Promise<string>;
  /**
   * completed (accept) and rejected: recipient only, from pending. voided: the payer cancels their
   * pending payment, or either side voids a completed one.
   */
  setSettlementStatus(settlementId: string, status: "completed" | "rejected" | "voided"): Promise<void>;

  /** Your notifications in this household, newest first. */
  listNotifications(householdId: string): Promise<AppNotification[]>;
  /** Marks the given notifications (or all of yours) as read. */
  markNotificationsRead(ids?: string[]): Promise<void>;
  /** Calls back when one of your notifications is added or changes. Returns an unsubscribe fn. */
  subscribeNotifications(onChange: () => void): () => void;

  createInvite(householdId: string): Promise<CreatedInvite>;
  previewInvite(token: string): Promise<InvitePreview | null>;
  acceptInvite(token: string, displayName?: string): Promise<string>;

  /** Resolves a stored receipt reference into something an <img>/<a> can open. */
  getReceiptUrl(ref: string): Promise<string>;

  /** Calls back when another client changes this household. Returns an unsubscribe fn. */
  subscribe(householdId: string, onChange: () => void): () => void;
  signOut(): Promise<void>;
}

export class RepositoryError extends Error {
  constructor(
    message: string,
    readonly code: "unauthenticated" | "forbidden" | "not_found" | "invalid" | "conflict" | "unknown" = "unknown",
  ) {
    super(message);
    this.name = "RepositoryError";
  }
}

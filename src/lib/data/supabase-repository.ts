import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type {
  AuditEvent,
  Category,
  Expense,
  HouseholdSnapshot,
  Member,
  PaymentMethod,
  Profile,
  RecurringExpense,
  Settlement,
  SettlementStatus,
  SplitMethod,
} from "@/lib/domain/types";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Cadence, SettleSchedule } from "@/lib/domain/recurring";
import {
  RepositoryError,
  type CreatedInvite,
  type ExpenseInput,
  type HouseholdSummary,
  type InvitePreview,
  type RecurringInput,
  type Repository,
  type SettlementInput,
} from "./repository";

const RECEIPTS_BUCKET = "receipts";

interface ProfileRow {
  id: string;
  display_name: string;
  avatar_url: string | null;
}
interface ExpenseRow {
  id: string;
  household_id: string;
  title: string;
  amount_cents: number;
  paid_by: string;
  category: Category;
  description: string | null;
  expense_date: string;
  split_method: SplitMethod;
  receipt_path: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  expense_splits: { user_id: string; share_cents: number; weight: number | null }[];
}
interface SettlementRow {
  id: string;
  household_id: string;
  paid_by: string;
  paid_to: string;
  amount_cents: number;
  payment_method: PaymentMethod;
  status: SettlementStatus;
  note: string | null;
  created_by: string;
  created_at: string;
  completed_at: string | null;
}
interface RecurringRow {
  id: string;
  household_id: string;
  title: string;
  amount_cents: number;
  paid_by: string;
  category: Category;
  description: string | null;
  split_method: SplitMethod;
  splits: { user_id: string; share_cents: number; weight: number | null }[];
  cadence: Cadence;
  anchor_day: number;
  next_date: string;
  created_by: string;
  created_at: string;
}
interface AuditRow {
  id: number;
  actor_id: string | null;
  entity_type: AuditEvent["entityType"];
  entity_id: string | null;
  action: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  created_at: string;
}

function toError(error: PostgrestError | Error | null | undefined): RepositoryError {
  if (!error) return new RepositoryError("Something went wrong.");
  const code = "code" in error ? error.code : undefined;
  const map: Record<string, RepositoryError["code"]> = {
    "28000": "unauthenticated",
    "42501": "forbidden",
    P0002: "not_found",
    "22023": "invalid",
    "23514": "invalid",
    "40001": "conflict",
    P0001: "conflict",
  };
  return new RepositoryError(error.message, (code && map[code]) || "unknown");
}

/** Without generated DB types PostgREST infers embedded rows loosely, so callers state the row shape. */
function unwrap<T>({ data, error }: { data: unknown; error: PostgrestError | null }): T {
  if (error) throw toError(error);
  return data as T;
}

/** Bigints arrive as numbers from PostgREST; all amounts stay well under 2^53. */
const num = (v: unknown) => Number(v);

export class SupabaseRepository implements Repository {
  readonly mode = "supabase" as const;
  private readonly db: SupabaseClient;

  constructor(db: SupabaseClient = getSupabaseBrowserClient()) {
    this.db = db;
  }

  private async userId(): Promise<string> {
    const { data } = await this.db.auth.getUser();
    if (!data.user) throw new RepositoryError("You need to sign in first.", "unauthenticated");
    return data.user.id;
  }

  async getCurrentUser(): Promise<Profile | null> {
    const { data } = await this.db.auth.getUser();
    if (!data.user) return null;
    const row = unwrap<ProfileRow | null>(
      await this.db.from("profiles").select("id, display_name, avatar_url").eq("id", data.user.id).maybeSingle(),
    );
    return {
      id: data.user.id,
      displayName: row?.display_name ?? data.user.email?.split("@")[0] ?? "You",
      avatarUrl: row?.avatar_url ?? null,
    };
  }

  async listHouseholds(): Promise<HouseholdSummary[]> {
    const uid = await this.userId();
    const rows = unwrap<{ role: "owner" | "member"; household: { id: string; name: string } | null }[]>(
      await this.db
        .from("household_members")
        .select("role, household:households(id, name)")
        .eq("user_id", uid)
        .is("left_at", null),
    );
    const ids = rows.flatMap((r) => (r.household ? [r.household.id] : []));
    if (ids.length === 0) return [];
    const roster = unwrap<{ household_id: string }[]>(
      await this.db.from("household_members").select("household_id").in("household_id", ids).is("left_at", null),
    );
    return rows
      .filter((r) => r.household)
      .map((r) => ({
        id: r.household!.id,
        name: r.household!.name,
        role: r.role,
        memberCount: roster.filter((m) => m.household_id === r.household!.id).length,
      }));
  }

  async getSnapshot(householdId: string): Promise<HouseholdSnapshot> {
    const [household, members, expenses, settlements, recurring, audit] = await Promise.all([
      this.db.from("households").select("id, name, created_by, created_at, settle_cadence, settle_day").eq("id", householdId).maybeSingle(),
      this.db
        .from("household_members")
        .select("role, joined_at, left_at, profile:profiles(id, display_name, avatar_url)")
        .eq("household_id", householdId),
      this.db
        .from("expenses")
        .select(
          "id, household_id, title, amount_cents, paid_by, category, description, expense_date, split_method, receipt_path, created_by, created_at, updated_at, expense_splits(user_id, share_cents, weight)",
        )
        .eq("household_id", householdId)
        .is("deleted_at", null)
        .order("expense_date", { ascending: false })
        .order("created_at", { ascending: false }),
      this.db.from("settlements").select("*").eq("household_id", householdId).order("created_at", { ascending: false }),
      this.db
        .from("recurring_expenses")
        .select("id, household_id, title, amount_cents, paid_by, category, description, split_method, splits, cadence, anchor_day, next_date, created_by, created_at")
        .eq("household_id", householdId)
        .is("stopped_at", null)
        .order("next_date"),
      this.db
        .from("audit_log")
        .select("id, actor_id, entity_type, entity_id, action, before, after, created_at")
        .eq("household_id", householdId)
        .in("action", ["update", "delete", "voided", "join", "leave", "kick", "rename", "repeat", "stop_repeat", "settle_day"])
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

    const h = unwrap<{
      id: string;
      name: string;
      created_by: string;
      created_at: string;
      settle_cadence: Cadence | null;
      settle_day: number | null;
    } | null>(household);
    if (!h) throw new RepositoryError("Household not found.", "not_found");

    const memberRows = unwrap<{ role: Member["role"]; joined_at: string; left_at: string | null; profile: ProfileRow | null }[]>(members);

    return {
      household: {
        id: h.id,
        name: h.name,
        createdBy: h.created_by,
        createdAt: h.created_at,
        settleCadence: h.settle_cadence,
        settleDay: h.settle_day,
      },
      members: memberRows
        .filter((m) => m.profile)
        .map((m) => ({
          id: m.profile!.id,
          displayName: m.profile!.display_name,
          avatarUrl: m.profile!.avatar_url,
          role: m.role,
          joinedAt: m.joined_at,
          leftAt: m.left_at,
        })),
      expenses: unwrap<ExpenseRow[]>(expenses).map(
        (e): Expense => ({
          id: e.id,
          householdId: e.household_id,
          title: e.title,
          amountCents: num(e.amount_cents),
          paidBy: e.paid_by,
          category: e.category,
          description: e.description,
          expenseDate: e.expense_date,
          splitMethod: e.split_method,
          splits: e.expense_splits.map((s) => ({
            userId: s.user_id,
            shareCents: num(s.share_cents),
            weight: s.weight === null ? null : num(s.weight),
          })),
          receiptUrl: e.receipt_path,
          createdBy: e.created_by,
          createdAt: e.created_at,
          updatedAt: e.updated_at,
        }),
      ),
      settlements: unwrap<SettlementRow[]>(settlements).map(
        (s): Settlement => ({
          id: s.id,
          householdId: s.household_id,
          paidBy: s.paid_by,
          paidTo: s.paid_to,
          amountCents: num(s.amount_cents),
          paymentMethod: s.payment_method,
          status: s.status,
          note: s.note,
          createdBy: s.created_by,
          createdAt: s.created_at,
          completedAt: s.completed_at,
        }),
      ),
      recurring: unwrap<RecurringRow[]>(recurring).map(
        (r): RecurringExpense => ({
          id: r.id,
          householdId: r.household_id,
          title: r.title,
          amountCents: num(r.amount_cents),
          paidBy: r.paid_by,
          category: r.category,
          description: r.description,
          splitMethod: r.split_method,
          splits: r.splits.map((s) => ({ userId: s.user_id, shareCents: num(s.share_cents), weight: s.weight === null ? null : num(s.weight) })),
          cadence: r.cadence,
          anchorDay: r.anchor_day,
          nextDate: r.next_date,
          createdBy: r.created_by,
          createdAt: r.created_at,
        }),
      ),
      audit: unwrap<AuditRow[]>(audit).map((a) => {
        const snap = a.after ?? a.before ?? {};
        const prior = a.before ?? {};
        return {
          id: String(a.id),
          actorId: a.actor_id,
          entityType: a.entity_type,
          entityId: a.entity_id,
          action: a.action,
          title: typeof snap.title === "string" ? snap.title : typeof snap.name === "string" ? snap.name : null,
          amountCents:
            snap.amount_cents != null ? num(snap.amount_cents) : prior.amount_cents != null ? num(prior.amount_cents) : null,
          createdAt: a.created_at,
        };
      }),
    };
  }

  async createHousehold(name: string): Promise<string> {
    return unwrap<string>(await this.db.rpc("create_household", { p_name: name }));
  }

  async renameHousehold(householdId: string, name: string): Promise<void> {
    unwrap(await this.db.rpc("rename_household", { p_household_id: householdId, p_name: name }));
  }

  async leaveHousehold(householdId: string): Promise<void> {
    unwrap(await this.db.rpc("leave_household", { p_household_id: householdId }));
  }

  async kickMember(householdId: string, userId: string): Promise<void> {
    unwrap(await this.db.rpc("kick_member", { p_household_id: householdId, p_user_id: userId }));
  }

  async updateProfile(displayName: string): Promise<void> {
    const uid = await this.userId();
    unwrap(await this.db.from("profiles").update({ display_name: displayName.trim() }).eq("id", uid));
  }

  private async uploadReceipt(householdId: string, file: File): Promise<string> {
    if (file.size > 5 * 1024 * 1024) throw new RepositoryError("Receipts must be under 5 MB.", "invalid");
    const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const path = `${householdId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await this.db.storage.from(RECEIPTS_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
    if (error) throw toError(error);
    return path;
  }

  private expenseArgs(input: ExpenseInput) {
    return {
      p_title: input.title,
      p_amount_cents: input.amountCents,
      p_paid_by: input.paidBy,
      p_category: input.category,
      p_description: input.description ?? "",
      p_expense_date: input.expenseDate,
      p_split_method: input.splitMethod,
      p_splits: input.splits.map((s) => ({ user_id: s.userId, share_cents: s.shareCents, weight: s.weight })),
    };
  }

  async createExpense(householdId: string, input: ExpenseInput): Promise<string> {
    const receiptPath = input.receipt ? await this.uploadReceipt(householdId, input.receipt) : null;
    return unwrap<string>(
      await this.db.rpc("create_expense", {
        p_household_id: householdId,
        ...this.expenseArgs(input),
        p_receipt_path: receiptPath,
        p_client_request_id: input.clientRequestId,
      }),
    );
  }

  async updateExpense(expenseId: string, input: ExpenseInput, expectedUpdatedAt: string): Promise<void> {
    let receiptPath: string | null;
    if (input.receipt === undefined) {
      const row = unwrap<{ receipt_path: string | null; household_id: string }>(
        await this.db.from("expenses").select("receipt_path, household_id").eq("id", expenseId).single(),
      );
      receiptPath = row.receipt_path;
    } else if (input.receipt === null) {
      receiptPath = null;
    } else {
      const row = unwrap<{ household_id: string }>(await this.db.from("expenses").select("household_id").eq("id", expenseId).single());
      receiptPath = await this.uploadReceipt(row.household_id, input.receipt);
    }
    unwrap(
      await this.db.rpc("update_expense", {
        p_expense_id: expenseId,
        ...this.expenseArgs(input),
        p_receipt_path: receiptPath,
        p_expected_updated_at: expectedUpdatedAt,
      }),
    );
  }

  async deleteExpense(expenseId: string): Promise<void> {
    unwrap(await this.db.rpc("delete_expense", { p_expense_id: expenseId }));
  }

  async createRecurring(householdId: string, input: RecurringInput): Promise<string> {
    const { p_expense_date: _unused, ...args } = this.expenseArgs({ ...input, expenseDate: input.startDate, clientRequestId: "" });
    return unwrap<string>(
      await this.db.rpc("create_recurring_expense", {
        p_household_id: householdId,
        ...args,
        p_cadence: input.cadence,
        p_start_date: input.startDate,
      }),
    );
  }

  async stopRecurring(recurringId: string): Promise<void> {
    unwrap(await this.db.rpc("stop_recurring_expense", { p_recurring_id: recurringId }));
  }

  async runDueRecurring(householdId: string, today: string): Promise<number> {
    return unwrap<number>(await this.db.rpc("run_due_recurring", { p_household_id: householdId, p_today: today }));
  }

  async setSettleSchedule(householdId: string, schedule: SettleSchedule | null): Promise<void> {
    unwrap(
      await this.db.rpc("set_settle_schedule", {
        p_household_id: householdId,
        p_cadence: schedule?.cadence ?? null,
        p_day: schedule?.day ?? null,
      }),
    );
  }

  async recordSettlement(householdId: string, input: SettlementInput): Promise<string> {
    return unwrap<string>(
      await this.db.rpc("record_settlement", {
        p_household_id: householdId,
        p_paid_by: input.paidBy,
        p_paid_to: input.paidTo,
        p_amount_cents: input.amountCents,
        p_payment_method: input.paymentMethod,
        p_status: input.status,
        p_note: input.note ?? "",
        p_client_request_id: input.clientRequestId,
      }),
    );
  }

  async setSettlementStatus(settlementId: string, status: "completed" | "voided"): Promise<void> {
    unwrap(await this.db.rpc("set_settlement_status", { p_settlement_id: settlementId, p_status: status }));
  }

  async createInvite(householdId: string): Promise<CreatedInvite> {
    const rows = unwrap<{ token: string; expires_at: string }[]>(
      await this.db.rpc("create_invitation", { p_household_id: householdId }),
    );
    return { token: rows[0].token, expiresAt: rows[0].expires_at };
  }

  async previewInvite(token: string): Promise<InvitePreview | null> {
    const rows = unwrap<
      { household_id: string; household_name: string; member_count: number; expires_at: string; is_valid: boolean }[]
    >(await this.db.rpc("preview_invitation", { p_token: token }));
    const r = rows[0];
    if (!r) return null;
    return {
      householdId: r.household_id,
      householdName: r.household_name,
      memberCount: r.member_count,
      expiresAt: r.expires_at,
      isValid: r.is_valid,
    };
  }

  async acceptInvite(token: string): Promise<string> {
    return unwrap<string>(await this.db.rpc("accept_invitation", { p_token: token }));
  }

  async getReceiptUrl(ref: string): Promise<string> {
    const { data, error } = await this.db.storage.from(RECEIPTS_BUCKET).createSignedUrl(ref, 60 * 10);
    if (error || !data) throw toError(error);
    return data.signedUrl;
  }

  subscribe(householdId: string, onChange: () => void): () => void {
    const filter = `household_id=eq.${householdId}`;
    const channel = this.db
      .channel(`household:${householdId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "expenses", filter }, onChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "settlements", filter }, onChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "household_members", filter }, onChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "recurring_expenses", filter }, onChange)
      .subscribe();
    return () => {
      void this.db.removeChannel(channel);
    };
  }

  async signOut(): Promise<void> {
    await this.db.auth.signOut();
  }
}

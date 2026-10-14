import { computeNetBalances } from "@/lib/domain/balances";
import { validateSplits } from "@/lib/domain/splits";
import { CATEGORIES, PAYMENT_METHODS, SPLIT_METHODS, type HouseholdSnapshot, type Profile } from "@/lib/domain/types";
import { createDemoState, type DemoAuditEvent, type DemoState } from "./demo-seed";
import {
  RepositoryError,
  type CreatedInvite,
  type ExpenseInput,
  type HouseholdSummary,
  type InvitePreview,
  type Repository,
  type SettlementInput,
} from "./repository";

const STORAGE_KEY = "roommate-ai:demo:v1";
const CHANNEL = "roommate-ai:demo";
const MAX_RECEIPT_BYTES = 1_500_000;
const LATENCY_MS = 180;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const uid = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function fileToDataUrl(file: File): Promise<string> {
  if (file.type.startsWith("image/")) {
    // Downscale photos so several receipts fit in localStorage.
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const url = canvas.toDataURL("image/jpeg", 0.72);
    if (url.length > MAX_RECEIPT_BYTES * 1.37) throw new RepositoryError("That receipt is too large for demo mode.", "invalid");
    return url;
  }
  if (file.size > MAX_RECEIPT_BYTES) throw new RepositoryError("Receipts must be under 1.5 MB in demo mode.", "invalid");
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new RepositoryError("Couldn't read that file.", "invalid"));
    reader.readAsDataURL(file);
  });
}

/**
 * Browser-only repository that persists a seeded household in localStorage.
 * It enforces the same rules as the Supabase RPCs (membership, permissions, cent totals,
 * idempotency) so the UI behaves identically in both modes.
 */
export class DemoRepository implements Repository {
  readonly mode = "demo" as const;
  private channel: BroadcastChannel | null =
    typeof window !== "undefined" && typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(CHANNEL) : null;
  private listeners = new Set<() => void>();

  constructor() {
    this.channel?.addEventListener("message", () => this.listeners.forEach((l) => l()));
    if (typeof window !== "undefined") {
      window.addEventListener("storage", (e) => {
        if (e.key === STORAGE_KEY) this.listeners.forEach((l) => l());
      });
    }
  }

  // ---- storage ---------------------------------------------------------------

  private read(): DemoState {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as DemoState;
        if (parsed.version === 1) return parsed;
      } catch {
        // fall through to reseed
      }
    }
    const fresh = createDemoState();
    this.write(fresh, false);
    return fresh;
  }

  private write(state: DemoState, notify = true) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      throw new RepositoryError("Your browser storage is full. Remove a receipt or reset the demo.", "invalid");
    }
    if (notify) this.channel?.postMessage("changed");
  }

  private async mutate<T>(fn: (s: DemoState) => T | Promise<T>): Promise<T> {
    await sleep(LATENCY_MS);
    const state = this.read();
    const result = await fn(state);
    this.write(state);
    return result;
  }

  private me(s: DemoState) {
    return s.currentUserId;
  }

  private activeMember(s: DemoState, householdId: string, userId: string) {
    return s.members.find((m) => m.householdId === householdId && m.id === userId && m.leftAt === null);
  }

  private requireMember(s: DemoState, householdId: string) {
    const m = this.activeMember(s, householdId, this.me(s));
    if (!m) throw new RepositoryError("You're not a member of this household.", "forbidden");
    return m;
  }

  private log(s: DemoState, e: Omit<DemoAuditEvent, "id" | "createdAt" | "actorId">) {
    s.audit.push({ ...e, id: uid("a"), actorId: this.me(s), createdAt: new Date().toISOString() });
  }

  private validateExpense(s: DemoState, householdId: string, input: ExpenseInput) {
    const title = input.title.trim();
    if (title.length < 1 || title.length > 120) throw new RepositoryError("Give the expense a name.", "invalid");
    if (!CATEGORIES.includes(input.category)) throw new RepositoryError("Unknown category.", "invalid");
    if (!SPLIT_METHODS.includes(input.splitMethod)) throw new RepositoryError("Unknown split method.", "invalid");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.expenseDate)) throw new RepositoryError("Pick a valid date.", "invalid");
    if (!this.activeMember(s, householdId, input.paidBy)) throw new RepositoryError("The payer must be a current roommate.", "invalid");
    const err = validateSplits(input.amountCents, input.splits);
    if (err) throw new RepositoryError(err, "invalid");
    for (const sp of input.splits) {
      if (!this.activeMember(s, householdId, sp.userId)) {
        throw new RepositoryError("Everyone in the split must be a current roommate.", "invalid");
      }
    }
  }

  private canEditExpense(s: DemoState, e: DemoState["expenses"][number]) {
    const me = this.me(s);
    const role = this.activeMember(s, e.householdId, me)?.role;
    return e.createdBy === me || e.paidBy === me || role === "owner";
  }

  // ---- reads -------------------------------------------------------------------

  async getCurrentUser(): Promise<Profile | null> {
    const s = this.read();
    return s.profiles.find((p) => p.id === s.currentUserId) ?? null;
  }

  async listHouseholds(): Promise<HouseholdSummary[]> {
    await sleep(LATENCY_MS / 2);
    const s = this.read();
    const me = this.me(s);
    return s.members
      .filter((m) => m.id === me && m.leftAt === null)
      .map((m) => {
        const h = s.households.find((x) => x.id === m.householdId)!;
        return {
          id: h.id,
          name: h.name,
          role: m.role,
          memberCount: s.members.filter((x) => x.householdId === h.id && x.leftAt === null).length,
        };
      });
  }

  async getSnapshot(householdId: string): Promise<HouseholdSnapshot> {
    await sleep(LATENCY_MS);
    const s = this.read();
    this.requireMember(s, householdId);
    const household = s.households.find((h) => h.id === householdId);
    if (!household) throw new RepositoryError("Household not found.", "not_found");
    const profile = (id: string) => s.profiles.find((p) => p.id === id)!;
    return {
      household,
      members: s.members
        .filter((m) => m.householdId === householdId)
        .map((m) => ({ ...profile(m.id), role: m.role, joinedAt: m.joinedAt, leftAt: m.leftAt })),
      expenses: s.expenses
        .filter((e) => e.householdId === householdId && e.deletedAt === null)
        .map(({ clientRequestId: _c, deletedAt: _d, deletedBy: _b, ...e }) => e),
      settlements: s.settlements
        .filter((x) => x.householdId === householdId)
        .map(({ clientRequestId: _c, ...x }) => x),
      audit: s.audit
        .filter((a) => a.householdId === householdId)
        .map((a) => ({
          id: a.id,
          actorId: a.actorId,
          entityType: a.entityType,
          entityId: a.entityId,
          action: a.action,
          title: typeof a.summary.title === "string" ? a.summary.title : null,
          amountCents: typeof a.summary.amountCents === "number" ? a.summary.amountCents : null,
          createdAt: a.createdAt,
        })),
    };
  }

  // ---- households & profile ----------------------------------------------------

  createHousehold(name: string): Promise<string> {
    return this.mutate((s) => {
      const trimmed = name.trim();
      if (trimmed.length < 1 || trimmed.length > 80) throw new RepositoryError("Household names are 1–80 characters.", "invalid");
      const id = uid("h");
      const now = new Date().toISOString();
      s.households.push({ id, name: trimmed, createdBy: this.me(s), createdAt: now });
      s.members.push({ householdId: id, id: this.me(s), role: "owner", joinedAt: now, leftAt: null });
      this.log(s, { householdId: id, entityType: "household", entityId: id, action: "create", summary: { title: trimmed } });
      return id;
    });
  }

  renameHousehold(householdId: string, name: string): Promise<void> {
    return this.mutate((s) => {
      if (this.requireMember(s, householdId).role !== "owner") {
        throw new RepositoryError("Only the household owner can rename it.", "forbidden");
      }
      const trimmed = name.trim();
      if (trimmed.length < 1 || trimmed.length > 80) throw new RepositoryError("Household names are 1–80 characters.", "invalid");
      s.households.find((h) => h.id === householdId)!.name = trimmed;
      this.log(s, { householdId, entityType: "household", entityId: householdId, action: "rename", summary: { title: trimmed } });
    });
  }

  leaveHousehold(householdId: string): Promise<void> {
    return this.mutate((s) => {
      const me = this.requireMember(s, householdId);
      const balances = computeNetBalances(
        [],
        s.expenses.filter((e) => e.householdId === householdId && e.deletedAt === null),
        s.settlements.filter((x) => x.householdId === householdId),
      );
      if ((balances.get(me.id) ?? 0) !== 0) {
        throw new RepositoryError("Settle your balance before leaving this household.", "conflict");
      }
      if (me.role === "owner") {
        const successor = s.members
          .filter((m) => m.householdId === householdId && m.leftAt === null && m.id !== me.id)
          .sort((a, b) => a.joinedAt.localeCompare(b.joinedAt))[0];
        if (successor) successor.role = "owner";
      }
      me.leftAt = new Date().toISOString();
      me.role = "member";
      this.log(s, { householdId, entityType: "member", entityId: me.id, action: "leave", summary: {} });
    });
  }

  kickMember(householdId: string, userId: string): Promise<void> {
    return this.mutate((s) => {
      const me = this.requireMember(s, householdId);
      if (me.role !== "owner") throw new RepositoryError("Only the household owner can remove a roommate.", "forbidden");
      if (userId === me.id) throw new RepositoryError("You can't remove yourself. Leave the household instead.", "invalid");
      const target = this.activeMember(s, householdId, userId);
      if (!target) throw new RepositoryError("That roommate isn't in this household.", "not_found");
      const balances = computeNetBalances(
        [],
        s.expenses.filter((e) => e.householdId === householdId && e.deletedAt === null),
        s.settlements.filter((x) => x.householdId === householdId),
      );
      if ((balances.get(target.id) ?? 0) !== 0) {
        throw new RepositoryError("Settle their balance before removing them from this household.", "conflict");
      }
      target.leftAt = new Date().toISOString();
      target.role = "member";
      const name = s.profiles.find((p) => p.id === target.id)?.displayName ?? "A roommate";
      this.log(s, { householdId, entityType: "member", entityId: target.id, action: "kick", summary: { title: name } });
    });
  }

  updateProfile(displayName: string): Promise<void> {
    return this.mutate((s) => {
      const trimmed = displayName.trim();
      if (trimmed.length < 1 || trimmed.length > 60) throw new RepositoryError("Names are 1–60 characters.", "invalid");
      s.profiles.find((p) => p.id === this.me(s))!.displayName = trimmed;
    });
  }

  // ---- expenses ------------------------------------------------------------------

  createExpense(householdId: string, input: ExpenseInput): Promise<string> {
    return this.mutate(async (s) => {
      this.requireMember(s, householdId);
      const dup = s.expenses.find((e) => e.clientRequestId === input.clientRequestId);
      if (dup) return dup.id;
      this.validateExpense(s, householdId, input);
      const receiptUrl = input.receipt ? await fileToDataUrl(input.receipt) : null;
      const now = new Date().toISOString();
      const id = uid("e");
      s.expenses.push({
        id,
        householdId,
        title: input.title.trim(),
        amountCents: input.amountCents,
        paidBy: input.paidBy,
        category: input.category,
        description: input.description?.trim() || null,
        expenseDate: input.expenseDate,
        splitMethod: input.splitMethod,
        splits: input.splits,
        receiptUrl,
        createdBy: this.me(s),
        createdAt: now,
        updatedAt: now,
        clientRequestId: input.clientRequestId,
        deletedAt: null,
        deletedBy: null,
      });
      this.log(s, { householdId, entityType: "expense", entityId: id, action: "create", summary: { title: input.title.trim(), amountCents: input.amountCents } });
      return id;
    });
  }

  updateExpense(expenseId: string, input: ExpenseInput, expectedUpdatedAt: string): Promise<void> {
    return this.mutate(async (s) => {
      const e = s.expenses.find((x) => x.id === expenseId && x.deletedAt === null);
      if (!e || !this.activeMember(s, e.householdId, this.me(s))) throw new RepositoryError("Expense not found.", "not_found");
      if (!this.canEditExpense(s, e)) throw new RepositoryError("Only the person who added or paid for this expense can edit it.", "forbidden");
      if (e.updatedAt !== expectedUpdatedAt) throw new RepositoryError("Someone else changed this expense. Refresh and try again.", "conflict");
      this.validateExpense(s, e.householdId, input);
      const receiptUrl = input.receipt === undefined ? e.receiptUrl : input.receipt === null ? null : await fileToDataUrl(input.receipt);
      Object.assign(e, {
        title: input.title.trim(),
        amountCents: input.amountCents,
        paidBy: input.paidBy,
        category: input.category,
        description: input.description?.trim() || null,
        expenseDate: input.expenseDate,
        splitMethod: input.splitMethod,
        splits: input.splits,
        receiptUrl,
        updatedAt: new Date().toISOString(),
      });
      this.log(s, { householdId: e.householdId, entityType: "expense", entityId: e.id, action: "update", summary: { title: e.title, amountCents: e.amountCents } });
    });
  }

  deleteExpense(expenseId: string): Promise<void> {
    return this.mutate((s) => {
      const e = s.expenses.find((x) => x.id === expenseId && x.deletedAt === null);
      if (!e || !this.activeMember(s, e.householdId, this.me(s))) throw new RepositoryError("Expense not found.", "not_found");
      if (!this.canEditExpense(s, e)) throw new RepositoryError("Only the person who added or paid for this expense can delete it.", "forbidden");
      e.deletedAt = new Date().toISOString();
      e.deletedBy = this.me(s);
      this.log(s, { householdId: e.householdId, entityType: "expense", entityId: e.id, action: "delete", summary: { title: e.title, amountCents: e.amountCents } });
    });
  }

  // ---- settlements ---------------------------------------------------------------

  recordSettlement(householdId: string, input: SettlementInput): Promise<string> {
    return this.mutate((s) => {
      this.requireMember(s, householdId);
      const dup = s.settlements.find((x) => x.clientRequestId === input.clientRequestId);
      if (dup) return dup.id;
      const me = this.me(s);
      if (input.paidBy !== me && input.paidTo !== me) throw new RepositoryError("You can only record payments you sent or received.", "forbidden");
      if (input.paidBy === input.paidTo) throw new RepositoryError("Payer and recipient must be different people.", "invalid");
      if (!this.activeMember(s, householdId, input.paidBy) || !this.activeMember(s, householdId, input.paidTo)) {
        throw new RepositoryError("Both people must be current roommates.", "invalid");
      }
      if (!Number.isSafeInteger(input.amountCents) || input.amountCents <= 0) throw new RepositoryError("Amount must be greater than zero.", "invalid");
      if (!PAYMENT_METHODS.includes(input.paymentMethod)) throw new RepositoryError("Unknown payment method.", "invalid");
      const now = new Date().toISOString();
      const id = uid("s");
      s.settlements.push({
        id,
        householdId,
        paidBy: input.paidBy,
        paidTo: input.paidTo,
        amountCents: input.amountCents,
        paymentMethod: input.paymentMethod,
        status: input.status,
        note: input.note?.trim() || null,
        createdBy: me,
        createdAt: now,
        completedAt: input.status === "completed" ? now : null,
        clientRequestId: input.clientRequestId,
      });
      return id;
    });
  }

  setSettlementStatus(settlementId: string, status: "completed" | "voided"): Promise<void> {
    return this.mutate((s) => {
      const x = s.settlements.find((p) => p.id === settlementId);
      if (!x || !this.activeMember(s, x.householdId, this.me(s))) throw new RepositoryError("Payment not found.", "not_found");
      if (x.paidBy !== this.me(s) && x.paidTo !== this.me(s)) throw new RepositoryError("Only the payer or recipient can change this payment.", "forbidden");
      if (status === "completed" && x.status !== "pending") throw new RepositoryError("Only pending payments can be marked completed.", "conflict");
      if (x.status === status) return;
      x.status = status;
      if (status === "completed") x.completedAt = new Date().toISOString();
      this.log(s, { householdId: x.householdId, entityType: "settlement", entityId: x.id, action: status, summary: { amountCents: x.amountCents } });
    });
  }

  // ---- invitations -----------------------------------------------------------------

  createInvite(householdId: string): Promise<CreatedInvite> {
    return this.mutate(async (s) => {
      this.requireMember(s, householdId);
      const token = randomToken();
      const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
      s.invitations.push({ id: uid("i"), householdId, tokenHash: await sha256Hex(token), expiresAt, maxUses: 5, useCount: 0, revokedAt: null, createdBy: this.me(s) });
      return { token, expiresAt };
    });
  }

  async previewInvite(token: string): Promise<InvitePreview | null> {
    await sleep(LATENCY_MS);
    const s = this.read();
    const hash = await sha256Hex(token);
    const inv = s.invitations.find((i) => i.tokenHash === hash);
    if (!inv) return null;
    const h = s.households.find((x) => x.id === inv.householdId)!;
    return {
      householdId: h.id,
      householdName: h.name,
      memberCount: s.members.filter((m) => m.householdId === h.id && m.leftAt === null).length,
      expiresAt: inv.expiresAt,
      isValid: inv.revokedAt === null && new Date(inv.expiresAt) > new Date() && inv.useCount < inv.maxUses,
    };
  }

  /**
   * In demo mode there's no second account, so accepting an invite creates a new local
   * roommate with the given name and switches the session to them.
   */
  acceptInvite(token: string, displayName?: string): Promise<string> {
    return this.mutate(async (s) => {
      const hash = await sha256Hex(token);
      const inv = s.invitations.find((i) => i.tokenHash === hash);
      if (!inv) throw new RepositoryError("This invite link is invalid.", "not_found");
      if (inv.revokedAt || new Date(inv.expiresAt) <= new Date() || inv.useCount >= inv.maxUses) {
        throw new RepositoryError("This invite link has expired or was already used.", "conflict");
      }
      const name = displayName?.trim();
      if (!name || name.length > 60) throw new RepositoryError("Tell your roommates your name.", "invalid");
      const id = uid("u");
      s.profiles.push({ id, displayName: name, avatarUrl: null });
      s.members.push({ householdId: inv.householdId, id, role: "member", joinedAt: new Date().toISOString(), leftAt: null });
      inv.useCount += 1;
      s.currentUserId = id;
      this.log(s, { householdId: inv.householdId, entityType: "member", entityId: id, action: "join", summary: {} });
      return inv.householdId;
    });
  }

  async getReceiptUrl(ref: string): Promise<string> {
    return ref;
  }

  subscribe(_householdId: string, onChange: () => void): () => void {
    this.listeners.add(onChange);
    return () => this.listeners.delete(onChange);
  }

  async signOut(): Promise<void> {
    this.resetDemo();
  }

  // ---- demo-only helpers ------------------------------------------------------------

  listProfiles(): Profile[] {
    return this.read().profiles;
  }

  switchUser(userId: string) {
    const s = this.read();
    if (!s.profiles.some((p) => p.id === userId)) return;
    s.currentUserId = userId;
    this.write(s);
  }

  resetDemo() {
    window.localStorage.removeItem(STORAGE_KEY);
    this.channel?.postMessage("changed");
  }
}

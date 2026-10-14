"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Paperclip, Plus, ReceiptText, X } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useAppData } from "@/components/providers/app-data-provider";
import { CATEGORY_META } from "@/components/shared/category";
import { AnimatedMoney } from "@/components/shared/animated-money";
import { MemberAvatar } from "@/components/shared/member-avatar";
import { TabPill } from "@/components/shared/tab-pill";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { centsToInput, formatCents, parseCents } from "@/lib/domain/money";
import { allocateProportionally, computeSplit, FULL_PERCENT_BP } from "@/lib/domain/splits";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  SPLIT_METHODS,
  SPLIT_METHOD_LABELS,
  type Category,
  type Expense,
  type Member,
  type SplitMethod,
} from "@/lib/domain/types";
import { firstName, todayDay } from "@/lib/format";
import { cn } from "@/lib/utils";

// Red is reserved for "owes", so the share bar sticks to greens, teals and blues.
const SHARE_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-5)", "var(--chart-6)", "var(--chart-3)", "var(--chart-7)"];

const bpToInput = (bp: number) => (bp / 100).toFixed(2).replace(/\.?0+$/, "");

function evenValues(method: SplitMethod, ids: string[], totalCents: number): Record<string, string> {
  if (ids.length === 0) return {};
  if (method === "shares") return Object.fromEntries(ids.map((id) => [id, "1"]));
  if (method === "percentage") {
    const bps = allocateProportionally(FULL_PERCENT_BP, ids.map(() => 1));
    return Object.fromEntries(ids.map((id, i) => [id, bpToInput(bps[i])]));
  }
  if (method === "custom") {
    if (totalCents <= 0) return {};
    const cents = allocateProportionally(totalCents, ids.map(() => 1));
    return Object.fromEntries(ids.map((id, i) => [id, centsToInput(cents[i])]));
  }
  return {};
}

function parseValue(method: SplitMethod, raw: string | undefined): number {
  if (!raw) return 0;
  if (method === "shares") return /^\d+$/.test(raw.trim()) ? Number(raw.trim()) : Number.NaN;
  const v = parseCents(raw); // percentages reuse the 2-decimal parser: "33.33" -> 3333 bp
  return v === null ? Number.NaN : v;
}

export function ExpenseFormDialog({
  open,
  onOpenChange,
  expense,
  formKey,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense: Expense | null;
  formKey: number;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[92dvh] flex-col gap-0 overflow-hidden border-t border-primary/25 p-0 shadow-[0_-20px_80px_-40px] shadow-primary/40 max-sm:top-auto max-sm:bottom-0 max-sm:left-0 max-sm:max-w-full max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-b-none sm:max-w-xl"
        onOpenAutoFocus={(e) => {
          // Don't pop the keyboard over the form on phones.
          if (window.matchMedia("(max-width: 640px)").matches) e.preventDefault();
        }}
      >
        {open ? <ExpenseForm key={formKey} expense={expense} onDone={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function ExpenseForm({ expense, onDone }: { expense: Expense | null; onDone: () => void }) {
  const { snapshot, user, createExpense, updateExpense } = useAppData();
  const members: Member[] = useMemo(() => snapshot?.members.filter((m) => m.leftAt === null) ?? [], [snapshot]);
  const isEdit = expense !== null;

  const [clientRequestId] = useState(() => crypto.randomUUID());
  const [title, setTitle] = useState(expense?.title ?? "");
  const [amountInput, setAmountInput] = useState(expense ? centsToInput(expense.amountCents) : "");
  const [paidBy, setPaidBy] = useState(expense?.paidBy ?? user?.id ?? members[0]?.id ?? "");
  const [date, setDate] = useState(expense?.expenseDate ?? todayDay());
  const [category, setCategory] = useState<Category>(expense?.category ?? "groceries");
  const [method, setMethod] = useState<SplitMethod>(expense?.splitMethod ?? "equal");
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(expense ? expense.splits.map((s) => s.userId) : members.map((m) => m.id)),
  );
  const [values, setValues] = useState<Record<string, string>>(() => {
    if (!expense) return {};
    return Object.fromEntries(
      expense.splits.map((s) => [
        s.userId,
        expense.splitMethod === "custom"
          ? centsToInput(s.shareCents)
          : expense.splitMethod === "percentage"
            ? bpToInput(s.weight ?? 0)
            : String(s.weight ?? 1),
      ]),
    );
  });
  const [description, setDescription] = useState(expense?.description ?? "");
  const [receipt, setReceipt] = useState<File | null | undefined>(undefined);
  const [showMore, setShowMore] = useState(Boolean(expense?.description || expense?.receiptUrl));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const amountCents = parseCents(amountInput);
  const participants = members.filter((m) => selected.has(m.id)).map((m) => m.id);
  const numericValues = Object.fromEntries(participants.map((id) => [id, parseValue(method, values[id])]));
  const split = computeSplit({ method, totalCents: amountCents ?? 0, participants, values: numericValues });
  const shareById = new Map(split.ok ? split.splits.map((s) => [s.userId, s.shareCents]) : []);

  const assignedCustom = participants.reduce((a, id) => a + (Number.isFinite(numericValues[id]) ? numericValues[id] : 0), 0);
  const assignedBp = assignedCustom;

  function changeMethod(next: SplitMethod) {
    setMethod(next);
    setValues(evenValues(next, participants, amountCents ?? 0));
  }

  function toggle(id: string, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function splitEvenly() {
    setValues(evenValues(method, participants, amountCents ?? 0));
  }

  const titleError = touched && title.trim() === "" ? "Give it a name, like “Costco run”." : null;
  const amountError = touched && (amountCents === null || amountCents <= 0) ? "Enter an amount greater than $0." : null;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    setError(null);
    if (submitting) return;
    if (title.trim() === "" || amountCents === null || amountCents <= 0) return;
    if (!split.ok) {
      setError(split.error);
      return;
    }
    setSubmitting(true);
    const input = {
      title: title.trim(),
      amountCents,
      paidBy,
      category,
      description: description.trim() || null,
      expenseDate: date,
      splitMethod: method,
      splits: split.splits,
      receipt,
      clientRequestId,
    };
    try {
      if (isEdit) {
        await updateExpense(expense.id, input, expense.updatedAt);
        toast.success("Expense updated", { description: "Balances were recalculated." });
      } else {
        await createExpense(input);
        toast.success(`Added ${title.trim()}`, { description: `${formatCents(amountCents)} split ${participants.length} ways` });
      }
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save this expense.");
      setSubmitting(false);
    }
  }

  const statusLine = (() => {
    if (!amountCents || participants.length === 0) return null;
    switch (method) {
      case "equal":
        return split.ok ? `${formatCents(Math.floor(amountCents / participants.length))}${amountCents % participants.length ? "–" + formatCents(Math.ceil(amountCents / participants.length)) : ""} each` : null;
      case "custom": {
        const left = amountCents - assignedCustom;
        return left === 0 ? "Fully assigned" : left > 0 ? `${formatCents(left)} left to assign` : `${formatCents(-left)} over the total`;
      }
      case "percentage": {
        const left = FULL_PERCENT_BP - assignedBp;
        return left === 0 ? "Adds up to 100%" : left > 0 ? `${bpToInput(left)}% left` : `${bpToInput(-left)}% over`;
      }
      case "shares": {
        const total = participants.reduce((a, id) => a + (Number.isFinite(numericValues[id]) ? numericValues[id] : 0), 0);
        return `${total} share${total === 1 ? "" : "s"} total`;
      }
    }
  })();
  const statusOk = split.ok;

  return (
    <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col" noValidate>
      <DialogHeader className="relative border-b border-white/[0.06] px-5 pt-5 pb-4">
        <span className="absolute top-2 left-1/2 h-1 w-10 -translate-x-1/2 rounded-full bg-white/15 sm:hidden" aria-hidden />
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-accent-foreground ring-1 ring-primary/25 shadow-[0_0_20px_-6px] shadow-primary/60">
            <ReceiptText className="size-5" />
          </span>
          <div className="min-w-0 space-y-1 text-left">
            <DialogTitle className="font-display text-xl font-semibold tracking-tight">{isEdit ? "Edit expense" : "Add an expense"}</DialogTitle>
            <DialogDescription>
              {isEdit ? "Changes recalculate everyone's balance." : "Log what you paid for and who it's for."}
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
        <div className="grid gap-4 sm:grid-cols-[1fr_11rem]">
          <div className="space-y-1.5">
            <Label htmlFor="expense-title">What was it?</Label>
            <Input
              id="expense-title"
              placeholder="e.g. Trader Joe's groceries"
              value={title}
              maxLength={120}
              onChange={(e) => setTitle(e.target.value)}
              aria-invalid={Boolean(titleError)}
              className="h-11 rounded-xl"
            />
            {titleError ? <p className="text-xs text-destructive">{titleError}</p> : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="expense-amount">Total</Label>
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 font-display text-lg text-accent-foreground">$</span>
              <Input
                id="expense-amount"
                inputMode="decimal"
                placeholder="0.00"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                aria-invalid={Boolean(amountError)}
                className="h-11 rounded-xl border-primary/30 bg-primary/[0.06] pl-8 font-display text-xl font-semibold tabular-nums shadow-[0_0_24px_-10px] shadow-primary/70 focus-visible:border-primary/60 md:text-xl"
              />
            </div>
            {amountError ? <p className="text-xs text-destructive">{amountError}</p> : null}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Paid by</Label>
            <Select value={paidBy} onValueChange={setPaidBy}>
              <SelectTrigger className="h-11 w-full rounded-xl" aria-label="Paid by">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.id === user?.id ? "You" : m.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="expense-date">Date</Label>
            <Input id="expense-date" type="date" value={date} max="2100-12-31" onChange={(e) => setDate(e.target.value)} className="h-11 rounded-xl [color-scheme:dark]" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Category</Label>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-7" role="radiogroup" aria-label="Category">
            {CATEGORIES.map((c) => {
              const Icon = CATEGORY_META[c].icon;
              const active = c === category;
              return (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setCategory(c)}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-xl border px-1 py-2.5 text-[11px] leading-tight font-medium transition-all active:scale-95",
                    active
                      ? "border-primary/60 bg-primary/10 text-accent-foreground shadow-[0_0_18px_-6px] shadow-primary/70"
                      : "border-white/[0.07] bg-white/[0.02] text-muted-foreground hover:border-white/15 hover:text-foreground",
                  )}
                >
                  <Icon className="size-4" />
                  <span className="line-clamp-1">{CATEGORY_LABELS[c].replace("Household ", "")}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <Label>Split</Label>
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              value={method}
              onValueChange={(v) => v && changeMethod(v as SplitMethod)}
              aria-label="Split method"
            >
              {SPLIT_METHODS.map((m) => (
                <ToggleGroupItem
                  key={m}
                  value={m}
                  className="relative isolate px-2.5 text-xs data-[state=on]:bg-transparent data-[state=on]:text-accent-foreground"
                >
                  {m === method ? <TabPill group="split-method" /> : null}
                  {SPLIT_METHOD_LABELS[m]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>

          <div className="divide-y divide-white/[0.06] overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.015]">
            {members.map((m) => {
              const on = selected.has(m.id);
              const share = shareById.get(m.id);
              return (
                <div key={m.id} className={cn("flex items-center gap-3 px-3 py-2.5 transition-opacity", !on && "opacity-45")}>
                  <Checkbox
                    id={`p-${m.id}`}
                    checked={on}
                    onCheckedChange={(v) => toggle(m.id, v === true)}
                    aria-label={`Include ${m.displayName}`}
                  />
                  <label htmlFor={`p-${m.id}`} className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
                    <MemberAvatar id={m.id} name={m.displayName} src={m.avatarUrl} size="sm" />
                    <span className="truncate text-sm font-medium">{m.id === user?.id ? "You" : firstName(m.displayName)}</span>
                  </label>
                  {on && method !== "equal" ? (
                    <div className="relative w-24">
                      {method === "custom" ? (
                        <span className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                      ) : null}
                      <Input
                        inputMode={method === "shares" ? "numeric" : "decimal"}
                        value={values[m.id] ?? ""}
                        onChange={(e) => setValues((v) => ({ ...v, [m.id]: e.target.value }))}
                        placeholder={method === "shares" ? "1" : "0"}
                        aria-label={`${SPLIT_METHOD_LABELS[method]} for ${m.displayName}`}
                        className={cn("h-8 text-right text-sm tabular-nums", method === "custom" && "pl-5", method === "percentage" && "pr-6")}
                      />
                      {method === "percentage" ? (
                        <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                      ) : null}
                    </div>
                  ) : null}
                  <span className={cn("w-20 text-right font-mono text-sm font-semibold tabular-nums", on && share ? "text-foreground" : "text-muted-foreground")}>
                    {on ? share !== undefined ? <AnimatedMoney cents={share} flash={false} /> : "—" : ""}
                  </span>
                </div>
              );
            })}
          </div>

          {split.ok && amountCents ? (
            <div className="flex h-1.5 gap-0.5 overflow-hidden rounded-full" aria-hidden>
              <AnimatePresence initial={false}>
                {split.splits.map((sp) => (
                  <motion.span
                    key={sp.userId}
                    className="h-full min-w-0 basis-0 rounded-full"
                    style={{ background: SHARE_COLORS[members.findIndex((m) => m.id === sp.userId) % SHARE_COLORS.length] }}
                    initial={{ flexGrow: 0, opacity: 0 }}
                    animate={{ flexGrow: sp.shareCents, opacity: 1 }}
                    exit={{ flexGrow: 0, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 260, damping: 30 }}
                  />
                ))}
              </AnimatePresence>
            </div>
          ) : null}

          <div className="flex items-center justify-between text-xs">
            <span className={cn("font-medium", statusOk ? "text-muted-foreground" : "text-amber-300")}>
              {participants.length === 0 ? "Pick at least one roommate" : statusLine}
            </span>
            {method !== "equal" && participants.length > 0 ? (
              <button type="button" onClick={splitEvenly} className="font-medium text-primary hover:underline">
                Reset to even
              </button>
            ) : null}
          </div>
        </div>

        {!showMore ? (
          <button type="button" className="text-sm font-medium text-primary hover:underline" onClick={() => setShowMore(true)}>
            + Add a note or receipt
          </button>
        ) : (
          <AnimatePresence initial={false}>
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="expense-notes">Notes</Label>
                <Textarea
                  id="expense-notes"
                  rows={2}
                  maxLength={1000}
                  placeholder="Optional details"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="expense-receipt">Receipt</Label>
                {receipt ? (
                  <div className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                    <Paperclip className="size-4 text-muted-foreground" />
                    <span className="flex-1 truncate">{receipt.name}</span>
                    <Button type="button" variant="ghost" size="icon-xs" onClick={() => setReceipt(undefined)} aria-label="Remove file">
                      <X />
                    </Button>
                  </div>
                ) : expense?.receiptUrl && receipt === undefined ? (
                  <div className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                    <Paperclip className="size-4 text-muted-foreground" />
                    <span className="flex-1">Receipt attached</span>
                    <Button type="button" variant="ghost" size="xs" onClick={() => setReceipt(null)}>
                      Remove
                    </Button>
                  </div>
                ) : (
                  <Input
                    id="expense-receipt"
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => setReceipt(e.target.files?.[0] ?? undefined)}
                    className="h-10 py-2"
                  />
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        )}

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
      </div>

      <div className="flex items-center gap-3 border-t border-white/[0.06] bg-black/20 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="min-w-0 flex-1 text-xs text-muted-foreground">
          {amountCents ? (
            <>
              <span className="block font-display text-lg leading-tight font-semibold text-foreground tabular-nums">{formatCents(amountCents)}</span>
              {participants.length === 1 ? "1 person" : `Split ${participants.length} ways`}
            </>
          ) : (
            "Enter an amount"
          )}
        </div>
        <Button type="button" variant="ghost" onClick={onDone} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" size="lg" disabled={submitting} className="h-10 min-w-32 rounded-xl px-4 font-semibold glow-primary">
          {submitting ? <Loader2 className="animate-spin" /> : isEdit ? null : <Plus strokeWidth={2.5} />}
          {isEdit ? "Save changes" : "Add expense"}
        </Button>
      </div>
    </form>
  );
}

"use client";

import { ExternalLink, Loader2, Paperclip, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useAppData } from "@/components/providers/app-data-provider";
import { useDialogs } from "@/components/providers/dialogs-provider";
import { CategoryIcon } from "@/components/shared/category";
import { MemberAvatar } from "@/components/shared/member-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatCents } from "@/lib/domain/money";
import { CATEGORY_LABELS, SPLIT_METHOD_LABELS, type Expense } from "@/lib/domain/types";
import { formatDay, formatTimestamp } from "@/lib/format";

export function canEditExpense(expense: Expense, userId: string | undefined, role: string | undefined) {
  return Boolean(userId) && (expense.createdBy === userId || expense.paidBy === userId || role === "owner");
}

export function ExpenseDetailDialog({ expense, onOpenChange }: { expense: Expense | null; onOpenChange: (open: boolean) => void }) {
  const { ledger, user, repo, deleteExpense } = useAppData();
  const { openAddExpense } = useDialogs();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [openingReceipt, setOpeningReceipt] = useState(false);

  const close = (open: boolean) => {
    if (!open) setConfirming(false);
    onOpenChange(open);
  };

  if (!ledger) return null;
  const role = user ? ledger.memberById.get(user.id)?.role : undefined;
  const editable = expense ? canEditExpense(expense, user?.id, role) && !expense.id.startsWith("optimistic-") : false;
  const name = (id: string) => (id === user?.id ? "You" : (ledger.memberById.get(id)?.displayName ?? "Former roommate"));

  async function onDelete() {
    if (!expense) return;
    setDeleting(true);
    try {
      await deleteExpense(expense.id);
      toast.success("Expense deleted", { description: "Balances were recalculated. It stays in the audit trail." });
      close(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't delete this expense.");
    } finally {
      setDeleting(false);
    }
  }

  async function openReceipt() {
    if (!expense?.receiptUrl) return;
    setOpeningReceipt(true);
    try {
      const url = await repo.getReceiptUrl(expense.receiptUrl);
      const w = window.open();
      if (w) {
        if (url.startsWith("data:")) {
          w.document.title = `Receipt — ${expense.title}`;
          const img = w.document.createElement(url.startsWith("data:application/pdf") ? "iframe" : "img");
          img.setAttribute("src", url);
          img.setAttribute("style", "max-width:100%;width:100%;height:100vh;object-fit:contain;border:0");
          w.document.body.style.margin = "0";
          w.document.body.appendChild(img);
        } else {
          w.location.href = url;
        }
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't open the receipt.");
    } finally {
      setOpeningReceipt(false);
    }
  }

  return (
    <Dialog open={expense !== null} onOpenChange={close}>
      <DialogContent className="gap-0 p-0 max-sm:top-auto max-sm:bottom-0 max-sm:left-0 max-sm:max-w-full max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-b-none sm:max-w-md">
        {expense ? (
          <>
            <DialogHeader className="border-b px-5 pt-5 pb-4">
              <div className="flex items-center gap-3">
                <CategoryIcon category={expense.category} />
                <div className="min-w-0">
                  <DialogTitle className="truncate text-lg font-semibold">{expense.title}</DialogTitle>
                  <DialogDescription>
                    {CATEGORY_LABELS[expense.category]} · {formatDay(expense.expenseDate)}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
            <div className="max-h-[60dvh] space-y-4 overflow-y-auto px-5 py-4">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="text-2xl font-semibold tabular-nums">{formatCents(expense.amountCents)}</p>
                </div>
                <Badge variant="secondary">{SPLIT_METHOD_LABELS[expense.splitMethod]} split</Badge>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-muted/60 p-3 text-sm">
                <MemberAvatar id={expense.paidBy} name={name(expense.paidBy)} size="sm" />
                <span>
                  <b>{name(expense.paidBy)}</b> paid
                </span>
              </div>
              <div>
                <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">Split between</p>
                <ul className="divide-y rounded-xl border">
                  {expense.splits.map((s) => {
                    const owes = s.userId !== expense.paidBy && s.shareCents > 0;
                    return (
                      <li key={s.userId} className="flex items-center gap-2 px-3 py-2 text-sm">
                        <MemberAvatar id={s.userId} name={name(s.userId)} size="sm" />
                        <span className="flex-1">
                          {name(s.userId)}
                          {expense.splitMethod === "percentage" && s.weight !== null ? (
                            <span className="ml-1 text-xs text-muted-foreground">{(s.weight / 100).toFixed(2).replace(/\.?0+$/, "")}%</span>
                          ) : null}
                          {expense.splitMethod === "shares" && s.weight !== null ? (
                            <span className="ml-1 text-xs text-muted-foreground">
                              {s.weight} share{s.weight === 1 ? "" : "s"}
                            </span>
                          ) : null}
                        </span>
                        <span className="font-medium tabular-nums">{formatCents(s.shareCents)}</span>
                        {owes ? <span className="w-24 text-right text-xs text-negative">owes {name(expense.paidBy) === "You" ? "you" : name(expense.paidBy).split(" ")[0]}</span> : <span className="w-24" />}
                      </li>
                    );
                  })}
                </ul>
                {!expense.splits.some((s) => s.userId === expense.paidBy) ? (
                  <p className="mt-2 text-xs text-muted-foreground">{name(expense.paidBy)} paid but isn&apos;t part of this split.</p>
                ) : null}
              </div>
              {expense.description ? <p className="rounded-xl border p-3 text-sm whitespace-pre-wrap">{expense.description}</p> : null}
              {expense.receiptUrl ? (
                <Button variant="outline" className="w-full" onClick={openReceipt} disabled={openingReceipt}>
                  {openingReceipt ? <Loader2 className="animate-spin" /> : <Paperclip />} View receipt <ExternalLink className="ml-auto" />
                </Button>
              ) : null}
              <p className="text-xs text-muted-foreground">
                Added by {name(expense.createdBy)} · {formatTimestamp(expense.createdAt)}
                {expense.updatedAt !== expense.createdAt ? ` · edited ${formatTimestamp(expense.updatedAt)}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-2 border-t bg-muted/40 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              {editable ? (
                confirming ? (
                  <>
                    <span className="flex-1 text-sm">Delete this expense?</span>
                    <Button variant="ghost" onClick={() => setConfirming(false)} disabled={deleting}>
                      Keep
                    </Button>
                    <Button variant="destructive" onClick={onDelete} disabled={deleting}>
                      {deleting ? <Loader2 className="animate-spin" /> : <Trash2 />} Delete
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="ghost" className="text-destructive" onClick={() => setConfirming(true)}>
                      <Trash2 /> Delete
                    </Button>
                    <Button
                      className="ml-auto"
                      onClick={() => {
                        close(false);
                        openAddExpense(expense);
                      }}
                    >
                      <Pencil /> Edit
                    </Button>
                  </>
                )
              ) : (
                <p className="text-xs text-muted-foreground">Only the person who added or paid for this can edit it.</p>
              )}
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

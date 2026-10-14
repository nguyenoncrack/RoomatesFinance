"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { ExpenseFormDialog } from "@/components/expenses/expense-form-dialog";
import { SettleUpDialog, type SettleUpPrefill } from "@/components/settlements/settle-up-dialog";
import type { Expense } from "@/lib/domain/types";

interface Dialogs {
  openAddExpense: (expense?: Expense) => void;
  openSettleUp: (prefill?: SettleUpPrefill) => void;
}

const DialogsContext = createContext<Dialogs | null>(null);

export function DialogsProvider({ children }: { children: ReactNode }) {
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [settleOpen, setSettleOpen] = useState(false);
  const [prefill, setPrefill] = useState<SettleUpPrefill | null>(null);
  // Bumped on every open so each form mounts with fresh state and a fresh idempotency key.
  const [formKey, setFormKey] = useState(0);

  const openAddExpense = useCallback((expense?: Expense) => {
    setEditing(expense ?? null);
    setFormKey((k) => k + 1);
    setExpenseOpen(true);
  }, []);

  const openSettleUp = useCallback((p?: SettleUpPrefill) => {
    setPrefill(p ?? null);
    setFormKey((k) => k + 1);
    setSettleOpen(true);
  }, []);

  const value = useMemo(() => ({ openAddExpense, openSettleUp }), [openAddExpense, openSettleUp]);

  return (
    <DialogsContext.Provider value={value}>
      {children}
      <ExpenseFormDialog open={expenseOpen} onOpenChange={setExpenseOpen} expense={editing} formKey={formKey} />
      <SettleUpDialog open={settleOpen} onOpenChange={setSettleOpen} prefill={prefill} formKey={formKey} />
    </DialogsContext.Provider>
  );
}

export function useDialogs() {
  const ctx = useContext(DialogsContext);
  if (!ctx) throw new Error("useDialogs must be used inside DialogsProvider");
  return ctx;
}

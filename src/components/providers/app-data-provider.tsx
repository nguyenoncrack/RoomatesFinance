"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { asDemo, getRepository, type ExpenseInput, type HouseholdSummary, type Repository, type SettlementInput } from "@/lib/data";
import type { Expense, HouseholdSnapshot, Profile, Settlement } from "@/lib/domain/types";
import { buildLedger, type Ledger } from "@/lib/ledger";

const ACTIVE_KEY = "roommate-ai:active-household";

type Status = "loading" | "ready" | "no-households" | "error";

interface AppData {
  repo: Repository;
  user: Profile | null;
  households: HouseholdSummary[];
  activeHouseholdId: string | null;
  snapshot: HouseholdSnapshot | null;
  ledger: Ledger | null;
  status: Status;
  error: string | null;
  setActiveHousehold: (id: string) => void;
  reload: () => Promise<void>;
  createExpense: (input: ExpenseInput) => Promise<void>;
  updateExpense: (id: string, input: ExpenseInput, expectedUpdatedAt: string) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  recordSettlement: (input: SettlementInput) => Promise<void>;
  setSettlementStatus: (id: string, status: "completed" | "voided") => Promise<void>;
  createHousehold: (name: string) => Promise<void>;
}

const AppDataContext = createContext<AppData | null>(null);

export function AppDataProvider({ children }: { children: ReactNode }) {
  const repo = useMemo(() => getRepository(), []);
  const [user, setUser] = useState<Profile | null>(null);
  const [households, setHouseholds] = useState<HouseholdSummary[]>([]);
  const [activeHouseholdId, setActiveId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<HouseholdSnapshot | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const activeRef = useRef<string | null>(null);
  const snapshotRef = useRef<HouseholdSnapshot | null>(null);
  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  const loadSnapshot = useCallback(
    async (householdId: string) => {
      const snap = await repo.getSnapshot(householdId);
      if (activeRef.current === householdId) setSnapshot(snap);
    },
    [repo],
  );

  const reload = useCallback(async () => {
    try {
      setError(null);
      const [me, list] = await Promise.all([repo.getCurrentUser(), repo.listHouseholds()]);
      setUser(me);
      setHouseholds(list);
      if (list.length === 0) {
        activeRef.current = null;
        setActiveId(null);
        setSnapshot(null);
        setStatus("no-households");
        return;
      }
      const stored = activeRef.current ?? window.localStorage.getItem(ACTIVE_KEY);
      const next = list.find((h) => h.id === stored)?.id ?? list[0].id;
      activeRef.current = next;
      setActiveId(next);
      await loadSnapshot(next);
      setStatus("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load your household.");
      setStatus("error");
    }
  }, [repo, loadSnapshot]);

  useEffect(() => {
    // Initial load from the (client-only) repository.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!activeHouseholdId) return;
    return repo.subscribe(activeHouseholdId, () => void reload());
  }, [repo, activeHouseholdId, reload]);

  const setActiveHousehold = useCallback(
    (id: string) => {
      activeRef.current = id;
      window.localStorage.setItem(ACTIVE_KEY, id);
      setActiveId(id);
      setSnapshot(null);
      loadSnapshot(id).catch((e) => {
        setError(e instanceof Error ? e.message : "Couldn't load that household.");
        setStatus("error");
      });
    },
    [loadSnapshot],
  );

  const ledgerResult = useMemo((): { ledger: Ledger | null; error: string | null } => {
    if (!snapshot) return { ledger: null, error: null };
    try {
      return { ledger: buildLedger(snapshot), error: null };
    } catch (e) {
      return { ledger: null, error: e instanceof Error ? e.message : "Ledger error" };
    }
  }, [snapshot]);

  /** Applies a local change immediately, then reconciles with the repository (rolling back on failure). */
  const optimistic = useCallback(
    async (apply: (s: HouseholdSnapshot) => HouseholdSnapshot, run: () => Promise<unknown>) => {
      const householdId = activeRef.current;
      if (!householdId) throw new Error("No household selected.");
      const previous = snapshotRef.current;
      if (previous) setSnapshot(apply(previous));
      try {
        await run();
      } catch (e) {
        setSnapshot(previous);
        throw e;
      }
      await reload();
    },
    [reload],
  );

  const createExpense = useCallback(
    (input: ExpenseInput) =>
      optimistic(
        (s) => {
          const now = new Date().toISOString();
          const temp: Expense = {
            id: `optimistic-${input.clientRequestId}`,
            householdId: s.household.id,
            title: input.title.trim(),
            amountCents: input.amountCents,
            paidBy: input.paidBy,
            category: input.category,
            description: input.description,
            expenseDate: input.expenseDate,
            splitMethod: input.splitMethod,
            splits: input.splits,
            receiptUrl: null,
            createdBy: user?.id ?? input.paidBy,
            createdAt: now,
            updatedAt: now,
          };
          return { ...s, expenses: [temp, ...s.expenses] };
        },
        () => repo.createExpense(activeRef.current!, input),
      ),
    [optimistic, repo, user],
  );

  const updateExpense = useCallback(
    (id: string, input: ExpenseInput, expectedUpdatedAt: string) =>
      optimistic(
        (s) => ({
          ...s,
          expenses: s.expenses.map((e) =>
            e.id === id
              ? { ...e, title: input.title, amountCents: input.amountCents, paidBy: input.paidBy, category: input.category, description: input.description, expenseDate: input.expenseDate, splitMethod: input.splitMethod, splits: input.splits }
              : e,
          ),
        }),
        () => repo.updateExpense(id, input, expectedUpdatedAt),
      ),
    [optimistic, repo],
  );

  const deleteExpense = useCallback(
    (id: string) => optimistic((s) => ({ ...s, expenses: s.expenses.filter((e) => e.id !== id) }), () => repo.deleteExpense(id)),
    [optimistic, repo],
  );

  const recordSettlement = useCallback(
    (input: SettlementInput) =>
      optimistic(
        (s) => {
          const now = new Date().toISOString();
          const temp: Settlement = {
            id: `optimistic-${input.clientRequestId}`,
            householdId: s.household.id,
            paidBy: input.paidBy,
            paidTo: input.paidTo,
            amountCents: input.amountCents,
            paymentMethod: input.paymentMethod,
            status: input.status,
            note: input.note,
            createdBy: user?.id ?? input.paidBy,
            createdAt: now,
            completedAt: input.status === "completed" ? now : null,
          };
          return { ...s, settlements: [temp, ...s.settlements] };
        },
        () => repo.recordSettlement(activeRef.current!, input),
      ),
    [optimistic, repo, user],
  );

  const setSettlementStatus = useCallback(
    (id: string, next: "completed" | "voided") =>
      optimistic(
        (s) => ({ ...s, settlements: s.settlements.map((x) => (x.id === id ? { ...x, status: next } : x)) }),
        () => repo.setSettlementStatus(id, next),
      ),
    [optimistic, repo],
  );

  const createHousehold = useCallback(
    async (name: string) => {
      const id = await repo.createHousehold(name);
      activeRef.current = id;
      window.localStorage.setItem(ACTIVE_KEY, id);
      await reload();
    },
    [repo, reload],
  );

  const value: AppData = {
    repo,
    user,
    households,
    activeHouseholdId,
    snapshot,
    ledger: ledgerResult.ledger,
    status: ledgerResult.error ? "error" : status,
    error: ledgerResult.error ?? error,
    setActiveHousehold,
    reload,
    createExpense,
    updateExpense,
    deleteExpense,
    recordSettlement,
    setSettlementStatus,
    createHousehold,
  };

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error("useAppData must be used inside AppDataProvider");
  return ctx;
}

export function useDemoRepository() {
  return asDemo(useAppData().repo);
}

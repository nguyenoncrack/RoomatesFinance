"use client";

import { format, parseISO, startOfMonth, subDays } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import { Paperclip, Receipt, Search, SearchX, X } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { useMemo, useState } from "react";
import { useAppData } from "@/components/providers/app-data-provider";
import { useDialogs } from "@/components/providers/dialogs-provider";
import { CategoryIcon } from "@/components/shared/category";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCents } from "@/lib/domain/money";
import { CATEGORIES, CATEGORY_LABELS, type Expense } from "@/lib/domain/types";
import { formatDay, todayDay } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ExpenseDetailDialog } from "./expense-detail-dialog";

type DateRange = "all" | "month" | "30d" | "90d" | "custom";

export function ExpensesView() {
  const { snapshot, ledger, user } = useAppData();
  const { openAddExpense } = useDialogs();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [payer, setPayer] = useState("all");
  const [involving, setInvolving] = useState("all");
  const [range, setRange] = useState<DateRange>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [viewingId, setViewingId] = useState<string | null>(null);

  const filtersActive = query !== "" || category !== "all" || payer !== "all" || involving !== "all" || range !== "all";

  const filtered = useMemo(() => {
    if (!snapshot) return [];
    const q = query.trim().toLowerCase();
    let start = "";
    let end = "";
    if (range === "month") start = format(startOfMonth(new Date()), "yyyy-MM-dd");
    if (range === "30d") start = format(subDays(new Date(), 30), "yyyy-MM-dd");
    if (range === "90d") start = format(subDays(new Date(), 90), "yyyy-MM-dd");
    if (range === "custom") {
      start = from;
      end = to;
    }
    return snapshot.expenses
      .filter((e) => {
        if (q && !`${e.title} ${e.description ?? ""}`.toLowerCase().includes(q)) return false;
        if (category !== "all" && e.category !== category) return false;
        if (payer !== "all" && e.paidBy !== payer) return false;
        if (involving !== "all" && e.paidBy !== involving && !e.splits.some((s) => s.userId === involving)) return false;
        if (start && e.expenseDate < start) return false;
        if (end && e.expenseDate > end) return false;
        return true;
      })
      .sort((a, b) => b.expenseDate.localeCompare(a.expenseDate) || b.createdAt.localeCompare(a.createdAt));
  }, [snapshot, query, category, payer, involving, range, from, to]);

  const groups = useMemo(() => {
    const map = new Map<string, Expense[]>();
    for (const e of filtered) {
      const key = e.expenseDate.slice(0, 7);
      map.set(key, [...(map.get(key) ?? []), e]);
    }
    return [...map];
  }, [filtered]);

  if (!snapshot || !ledger || !user) return null;
  const viewing = snapshot.expenses.find((e) => e.id === viewingId) ?? null;
  const members = snapshot.members;
  const name = (id: string) => (id === user.id ? "You" : (ledger.shortName.get(id) ?? "Former"));

  function clear() {
    setQuery("");
    setCategory("all");
    setPayer("all");
    setInvolving("all");
    setRange("all");
    setFrom("");
    setTo("");
  }

  return (
    <div className="stagger-children space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight md:hidden">Expenses</h2>
          <p className="text-sm text-muted-foreground">
            {filtered.length} of {snapshot.expenses.length} expenses · {formatCents(filtered.reduce((a, e) => a + e.amountCents, 0))}
          </p>
        </div>
      </div>

      <Card tone="sky" className="py-3">
        <CardContent className="space-y-3 px-3">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search expenses and notes"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-10 pl-9"
              aria-label="Search expenses"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-full" aria-label="Category filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {CATEGORY_LABELS[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={payer} onValueChange={setPayer}>
              <SelectTrigger className="w-full" aria-label="Payer filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Paid by anyone</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    Paid by {m.id === user.id ? "you" : ledger.shortName.get(m.id)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={involving} onValueChange={setInvolving}>
              <SelectTrigger className="w-full" aria-label="Roommate filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any roommate</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    Involving {m.id === user.id ? "you" : ledger.shortName.get(m.id)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={range} onValueChange={(v) => setRange(v as DateRange)}>
              <SelectTrigger className="w-full" aria-label="Date filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All time</SelectItem>
                <SelectItem value="month">This month</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
                <SelectItem value="custom">Custom range</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {range === "custom" ? (
            <div className="grid grid-cols-2 gap-2">
              <Input type="date" value={from} max={to || todayDay()} onChange={(e) => setFrom(e.target.value)} aria-label="From date" />
              <Input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} aria-label="To date" />
            </div>
          ) : null}
          {filtersActive ? (
            <Button variant="ghost" size="sm" onClick={clear} className="text-muted-foreground">
              <X /> Clear filters
            </Button>
          ) : null}
        </CardContent>
      </Card>

      {snapshot.expenses.length === 0 ? (
        <Card tone="butter">
          <CardContent>
            <EmptyState
              icon={Receipt}
              title="No expenses yet"
              action={
                <Button mark="star" onClick={() => openAddExpense()}>
                  Add the first expense
                </Button>
              }
            >
              When someone pays for something shared, log it here and we&apos;ll keep everyone&apos;s balance up to date.
            </EmptyState>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card tone="lilac">
          <CardContent>
            <EmptyState
              icon={SearchX}
              tone="neutral"
              title="No expenses match those filters"
              action={
                <Button variant="outline" size="sm" mark="cross" onClick={clear} className="bg-card">
                  Clear filters
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {groups.map(([month, items]) => (
            <section key={month}>
              <div className="mb-2 flex items-baseline justify-between px-1">
                <h3 className="font-display text-2xl leading-none">{format(parseISO(`${month}-01`), "MMMM yyyy")}</h3>
                <span className="text-xs text-muted-foreground tabular-nums">{formatCents(items.reduce((a, e) => a + e.amountCents, 0))}</span>
              </div>
              <Card className="py-1">
                <ul className="divide-y">
                  <AnimatePresence initial={false}>
                    {items.map((e) => {
                      const myShare = e.splits.find((s) => s.userId === user.id)?.shareCents ?? 0;
                      const impact = (e.paidBy === user.id ? e.amountCents : 0) - myShare;
                      return (
                        <motion.li key={e.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, height: 0 }}>
                          <button
                            onClick={() => setViewingId(e.id)}
                            className={cn(
                              "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60",
                              e.id.startsWith("optimistic-") && "opacity-60",
                            )}
                          >
                            <CategoryIcon category={e.category} />
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center gap-1.5 text-sm font-medium">
                                <span className="truncate">{e.title}</span>
                                {e.receiptUrl ? <Paperclip className="size-3 shrink-0 text-muted-foreground" aria-label="Has receipt" /> : null}
                              </span>
                              <span className="block truncate text-xs text-muted-foreground">
                                {name(e.paidBy)} paid · {formatDay(e.expenseDate)} · {e.splits.map((s) => name(s.userId)).join(", ")}
                              </span>
                            </span>
                            <span className="text-right">
                              <span className="block text-sm font-semibold tabular-nums">{formatCents(e.amountCents)}</span>
                              <span
                                className={cn(
                                  "block text-[11px] tabular-nums",
                                  impact > 0 ? "text-positive" : impact < 0 ? "text-negative" : "text-muted-foreground",
                                )}
                              >
                                {impact > 0
                                  ? `you lent ${formatCents(impact)}`
                                  : impact < 0
                                    ? `your share ${formatCents(-impact)}`
                                    : e.paidBy === user.id || myShare > 0
                                      ? "just you"
                                      : "not involved"}
                              </span>
                            </span>
                          </button>
                        </motion.li>
                      );
                    })}
                  </AnimatePresence>
                </ul>
              </Card>
            </section>
          ))}
        </div>
      )}

      <ExpenseDetailDialog expense={viewing} onOpenChange={(o) => !o && setViewingId(null)} />
    </div>
  );
}

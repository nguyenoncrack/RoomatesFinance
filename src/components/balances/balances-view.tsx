"use client";

import { ArrowRight, Info } from "lucide-react";
import { useMemo, useState } from "react";
import { useAppData } from "@/components/providers/app-data-provider";
import { CategoryIcon } from "@/components/shared/category";
import { MemberAvatar } from "@/components/shared/member-avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TabPill } from "@/components/shared/tab-pill";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { expenseDebts } from "@/lib/domain/balances";
import { formatCents } from "@/lib/domain/money";
import { firstName, formatDay } from "@/lib/format";
import { MemberBalanceList } from "./member-balance-list";
import { TransferList } from "./transfer-list";

export function BalancesView() {
  const { snapshot, ledger, user } = useAppData();
  const [view, setView] = useState("simplified");
  const perExpense = useMemo(() => (snapshot ? expenseDebts(snapshot.expenses) : []), [snapshot]);

  if (!snapshot || !ledger || !user) return null;
  const name = (id: string) => (id === user.id ? "You" : firstName(ledger.memberById.get(id)?.displayName ?? "Former roommate"));
  const expenseById = new Map(snapshot.expenses.map((e) => [e.id, e]));
  const saved = ledger.original.length - ledger.simplified.length;
  const completedPayments = snapshot.settlements.filter((s) => s.status === "completed");

  return (
    <div className="stagger-children space-y-5">
      <h2 className="text-2xl font-semibold tracking-tight md:hidden">Balances</h2>
      <div className="grid items-start gap-4 lg:grid-cols-[1fr_1.2fr]">
        <Card>
          <CardHeader>
            <CardTitle>Net balances</CardTitle>
            <CardDescription>What each person paid minus their share, after completed payments.</CardDescription>
          </CardHeader>
          <CardContent>
            <MemberBalanceList detailed />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>How to settle</CardTitle>
            <CardDescription>
              {view === "simplified"
                ? saved > 0
                  ? `${ledger.simplified.length} payment${ledger.simplified.length === 1 ? "" : "s"} instead of ${ledger.original.length} — ${saved} fewer.`
                  : "Payments needed to square everyone up."
                : "Who owes whom directly from shared expenses, without routing through others."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={view} onValueChange={setView}>
              <TabsList className="mb-4 w-full">
                <TabsTrigger value="simplified" className="relative isolate data-active:bg-transparent dark:data-active:border-transparent dark:data-active:bg-transparent">
                  {view === "simplified" ? <TabPill group="balances-view" /> : null}
                  Simplified
                </TabsTrigger>
                <TabsTrigger value="original" className="relative isolate data-active:bg-transparent dark:data-active:border-transparent dark:data-active:bg-transparent">
                  {view === "original" ? <TabPill group="balances-view" /> : null}
                  Original debts
                </TabsTrigger>
              </TabsList>
              <TabsContent value="simplified" className="space-y-4">
                <TransferList transfers={ledger.simplified} />
                <p className="flex gap-2 rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
                  <Info className="mt-0.5 size-3.5 shrink-0" />
                  We match the biggest debtor with the biggest creditor until everyone is at zero. It&apos;s deterministic and
                  usually cuts the number of payments a lot, though it isn&apos;t guaranteed to be the absolute minimum.
                </p>
              </TabsContent>
              <TabsContent value="original" className="space-y-5">
                <TransferList transfers={ledger.original} compact emptyText="No direct debts between roommates." />
                <div>
                  <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">Expense by expense</p>
                  {perExpense.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nothing to show yet.</p>
                  ) : (
                    <ul className="max-h-96 divide-y overflow-y-auto rounded-xl border">
                      {perExpense.map((d) => {
                        const e = expenseById.get(d.expenseId)!;
                        return (
                          <li key={`${d.expenseId}-${d.from}`} className="flex items-center gap-3 px-3 py-2">
                            <CategoryIcon category={e.category} className="size-7 rounded-lg" />
                            <span className="min-w-0 flex-1 text-xs">
                              <span className="block truncate font-medium text-foreground">{e.title}</span>
                              <span className="text-muted-foreground">
                                {name(d.from)} <ArrowRight className="inline size-3" /> {name(d.to)} · {formatDay(e.expenseDate)}
                              </span>
                            </span>
                            <span className="text-xs font-semibold tabular-nums">{formatCents(d.amountCents)}</span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  {completedPayments.length ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {completedPayments.length} completed payment{completedPayments.length === 1 ? "" : "s"} totaling{" "}
                      {formatCents(completedPayments.reduce((a, s) => a + s.amountCents, 0))} are netted into the pair totals above.
                    </p>
                  ) : null}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your position with each roommate</CardTitle>
          <CardDescription>Direct balance from shared expenses (original debts), after payments between you two.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {snapshot.members
            .filter((m) => m.id !== user.id && m.leftAt === null)
            .map((m) => {
              const owesMe = ledger.original.find((t) => t.from === m.id && t.to === user.id)?.amountCents ?? 0;
              const iOwe = ledger.original.find((t) => t.from === user.id && t.to === m.id)?.amountCents ?? 0;
              const net = owesMe - iOwe;
              return (
                <div key={m.id} className="flex items-center gap-3 rounded-xl border p-3">
                  <MemberAvatar id={m.id} name={m.displayName} src={m.avatarUrl} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{m.displayName}</p>
                    <p className={`text-xs ${net > 0 ? "text-positive" : net < 0 ? "text-negative" : "text-muted-foreground"}`}>
                      {net > 0 ? `owes you ${formatCents(net)}` : net < 0 ? `you owe ${formatCents(-net)}` : "even"}
                    </p>
                  </div>
                </div>
              );
            })}
        </CardContent>
      </Card>
    </div>
  );
}

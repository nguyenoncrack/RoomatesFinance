"use client";

import { motion } from "framer-motion";
import { ArrowRight, HandCoins, Plus, Receipt } from "lucide-react";
import Link from "next/link";
import { MemberBalanceList } from "@/components/balances/member-balance-list";
import { TransferList } from "@/components/balances/transfer-list";
import { ActivityFeed } from "@/components/activity/activity-feed";
import { useAppData } from "@/components/providers/app-data-provider";
import { useDialogs } from "@/components/providers/dialogs-provider";
import { AnimatedMoney } from "@/components/shared/animated-money";
import { EmptyState } from "@/components/shared/empty-state";
import { CodeComment, Cursor, StatTile, TerminalPanel } from "@/components/shared/terminal-panel";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buildActivity } from "@/lib/activity";
import { spendingThisMonth } from "@/lib/analytics";
import { formatCents } from "@/lib/domain/money";
import { firstName } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Analytics } from "./analytics";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, duration: 0.35, ease: [0.22, 1, 0.36, 1] as const },
});

function CardLink({ href, children }: { href: string; children: string }) {
  return (
    <Button variant="ghost" size="sm" asChild className="group/link rounded-full text-muted-foreground hover:text-foreground">
      <Link href={href}>
        {children}
        <ArrowRight className="transition-transform group-hover/link:translate-x-0.5" />
      </Link>
    </Button>
  );
}

export function DashboardView() {
  const { ledger, snapshot, user } = useAppData();
  const { openAddExpense, openSettleUp } = useDialogs();
  if (!ledger || !snapshot || !user) return null;

  const net = ledger.balances.get(user.id) ?? 0;
  const myDebts = ledger.simplified.filter((t) => t.from === user.id);
  const myCredits = ledger.simplified.filter((t) => t.to === user.id);
  const iOwe = myDebts.reduce((a, t) => a + t.amountCents, 0);
  const owedToMe = myCredits.reduce((a, t) => a + t.amountCents, 0);
  const monthTotal = spendingThisMonth(snapshot.expenses);
  const monthCount = snapshot.expenses.filter((e) => e.expenseDate.slice(0, 7) === new Date().toISOString().slice(0, 7)).length;
  const activity = buildActivity(snapshot).slice(0, 6);
  const nameOf = (id: string) => firstName(ledger.memberById.get(id)?.displayName ?? "Former roommate");
  const creditors = myDebts.map((t) => nameOf(t.to));
  const debtors = myCredits.map((t) => nameOf(t.from));
  const tone = net > 0 ? "positive" : net < 0 ? "negative" : "neutral";
  const me = firstName(user.displayName);
  const activeMembers = snapshot.members.filter((m) => m.leftAt === null).length;

  return (
    <div className="space-y-6 md:space-y-8">
      <section className="grid grid-cols-[minmax(0,1fr)] items-center gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-10">
        <motion.div {...fadeUp()} className="space-y-5">
          <span className="hidden items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-muted-foreground md:inline-flex">
            <span className="size-1.5 rounded-full bg-primary shadow-[0_0_8px] shadow-primary" />
            {snapshot.household.name} · {activeMembers} roommate{activeMembers === 1 ? "" : "s"}
          </span>
          <h2 className="font-display text-[2.1rem] leading-[1.08] font-bold tracking-tight sm:text-5xl">
            Hey {me},
            <br />
            {net < 0 ? (
              <>
                you owe <span className="text-negative text-glow">
                  <AnimatedMoney cents={-net} />
                </span>.
              </>
            ) : net > 0 ? (
              <>
                you&apos;re up <span className="text-gradient">
                  <AnimatedMoney cents={net} flash={false} />
                </span>.
              </>
            ) : (
              <>
                you&apos;re <span className="text-gradient">all square</span>.
              </>
            )}
          </h2>
          <p className="max-w-md text-[15px] leading-relaxed text-muted-foreground">
            {net < 0
              ? `Pay ${creditors.join(" and ")} to get back to zero. Balances are simplified, so that's the fewest transfers we found.`
              : net > 0
                ? `${debtors.join(" and ")} ${debtors.length === 1 ? "owes" : "owe"} you. Nudge them, or record it when the money lands.`
                : "Nothing to pay and nothing to collect. Log the next grocery run and we'll keep the math honest."}
          </p>
          <div className="flex flex-wrap gap-3">
            <Button size="lg" onClick={() => openAddExpense()} className="h-11 rounded-xl px-5 text-[15px] font-semibold glow-primary glow-pulse">
              <Plus strokeWidth={2.5} /> Add Expense
            </Button>
            <Button size="lg" variant="outline" onClick={() => openSettleUp()} className="h-11 rounded-xl border-white/10 bg-white/[0.03] px-5 text-[15px]">
              <HandCoins /> Settle up
            </Button>
          </div>
        </motion.div>

        <motion.div {...fadeUp(0.08)}>
          <TerminalPanel
            command="ledger.simplify()"
            status="Live balance"
            className={cn(tone === "negative" && "border-negative/20 glow-negative")}
            footer={
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <StatTile label="Your balance" value={<AnimatedMoney cents={net} signed />} tone={tone} />
                <StatTile label="You owe" value={<AnimatedMoney cents={iOwe} />} tone={iOwe ? "negative" : "neutral"} />
                <StatTile label="Owed to you" value={<AnimatedMoney cents={owedToMe} />} tone={owedToMe ? "positive" : "neutral"} />
                <StatTile label="This month" value={<AnimatedMoney cents={monthTotal} />} hint={`${monthCount} expense${monthCount === 1 ? "" : "s"}`} />
              </div>
            }
          >
            <CodeComment>pulling {snapshot.household.name} ledger…</CodeComment>
            <div className="truncate">
              <span className="text-teal-300">const</span> you = <span className="text-teal-300">await</span>{" "}
              <span className="text-emerald-300">ledger.net</span>(<span className="text-amber-200">&quot;{me}&quot;</span>);
            </div>
            <div className="truncate">
              you.balance{"  "}={" "}
              <span className={cn(tone === "positive" && "text-positive", tone === "negative" && "text-negative")}>
                {formatCents(net, { signed: true })} {net > 0 ? "▲" : net < 0 ? "▼" : ""}
              </span>
            </div>
            {myDebts.slice(0, 2).map((t) => (
              <div key={t.to} className="truncate">
                you.<span className="text-emerald-300">pay</span>({nameOf(t.to).toLowerCase()},{" "}
                <span className="text-negative">{formatCents(t.amountCents)}</span>);
              </div>
            ))}
            {myCredits.slice(0, 2).map((t) => (
              <div key={t.from} className="truncate">
                {nameOf(t.from).toLowerCase()}.<span className="text-emerald-300">pay</span>(you,{" "}
                <span className="text-positive">{formatCents(t.amountCents)}</span>);
              </div>
            ))}
            <div className="truncate">
              <span className="text-teal-300">return</span> <span className="text-emerald-300">settle</span>(you, roommates);
              <Cursor />
            </div>
          </TerminalPanel>
        </motion.div>
      </section>

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 md:gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <motion.div {...fadeUp(0.12)}>
          <Card lift>
            <CardHeader>
              <CardTitle>Who pays whom</CardTitle>
              <CardDescription>Simplified so the household needs fewer payments.</CardDescription>
              <CardAction>
                <CardLink href="/balances">Details</CardLink>
              </CardAction>
            </CardHeader>
            <CardContent>
              <TransferList transfers={ledger.simplified} />
            </CardContent>
          </Card>
        </motion.div>
        <motion.div {...fadeUp(0.16)} className="lg:row-span-2">
          <Card lift>
            <CardHeader>
              <CardTitle>Balances</CardTitle>
              <CardDescription>
                <span className="text-positive">Green</span> gets money back, <span className="text-negative">red</span> owes.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <MemberBalanceList detailed />
            </CardContent>
          </Card>
        </motion.div>
        <motion.div {...fadeUp(0.2)}>
          <Card lift>
            <CardHeader>
              <CardTitle>Recent activity</CardTitle>
              <CardAction>
                <CardLink href="/activity">See all</CardLink>
              </CardAction>
            </CardHeader>
            <CardContent>
              {activity.length === 0 ? (
                <EmptyState
                  icon={Receipt}
                  title="No expenses yet"
                  action={
                    <Button onClick={() => openAddExpense()} className="rounded-full px-4 glow-primary">
                      <Plus /> Add Expense
                    </Button>
                  }
                >
                  Add your first shared expense — groceries, rent, the Wi-Fi bill.
                </EmptyState>
              ) : (
                <ActivityFeed items={activity} />
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <Analytics />
    </div>
  );
}

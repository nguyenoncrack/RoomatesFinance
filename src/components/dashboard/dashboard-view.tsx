"use client";

import { motion } from "framer-motion";
import { ArrowDownLeft, ArrowUpRight, CalendarDays, Receipt, Wallet } from "lucide-react";
import Link from "next/link";
import { MemberBalanceList } from "@/components/balances/member-balance-list";
import { TransferList } from "@/components/balances/transfer-list";
import { ActivityFeed } from "@/components/activity/activity-feed";
import { useAppData } from "@/components/providers/app-data-provider";
import { useDialogs } from "@/components/providers/dialogs-provider";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buildActivity } from "@/lib/activity";
import { spendingThisMonth } from "@/lib/analytics";
import { formatCents } from "@/lib/domain/money";
import { firstName } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Analytics } from "./analytics";

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "neutral",
  index,
}: {
  label: string;
  value: string;
  hint: string;
  icon: typeof Wallet;
  tone?: "positive" | "negative" | "neutral" | "primary";
  index: number;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04, duration: 0.25 }}>
      <Card className="h-full gap-2 py-4">
        <CardContent className="space-y-2 px-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <span
              className={cn(
                "flex size-7 items-center justify-center rounded-lg",
                tone === "positive" && "bg-positive-soft text-positive",
                tone === "negative" && "bg-negative-soft text-negative",
                tone === "neutral" && "bg-muted text-muted-foreground",
                tone === "primary" && "bg-accent text-accent-foreground",
              )}
            >
              <Icon className="size-3.5" />
            </span>
          </div>
          <p
            className={cn(
              "text-xl font-semibold tracking-tight tabular-nums sm:text-2xl",
              tone === "positive" && "text-positive",
              tone === "negative" && "text-negative",
            )}
          >
            {value}
          </p>
          <p className="truncate text-xs text-muted-foreground">{hint}</p>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export function DashboardView() {
  const { ledger, snapshot, user } = useAppData();
  const { openAddExpense } = useDialogs();
  if (!ledger || !snapshot || !user) return null;

  const net = ledger.balances.get(user.id) ?? 0;
  const iOwe = ledger.simplified.filter((t) => t.from === user.id).reduce((a, t) => a + t.amountCents, 0);
  const owedToMe = ledger.simplified.filter((t) => t.to === user.id).reduce((a, t) => a + t.amountCents, 0);
  const monthTotal = spendingThisMonth(snapshot.expenses);
  const monthCount = snapshot.expenses.filter((e) => e.expenseDate.slice(0, 7) === new Date().toISOString().slice(0, 7)).length;
  const activity = buildActivity(snapshot).slice(0, 6);
  const creditors = ledger.simplified.filter((t) => t.from === user.id).map((t) => firstName(ledger.memberById.get(t.to)?.displayName ?? ""));

  return (
    <div className="space-y-6">
      <div>
        <p className="hidden text-sm text-muted-foreground md:block">{snapshot.household.name}</p>
        <h2 className="text-2xl font-semibold tracking-tight">Hey {firstName(user.displayName)}</h2>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          index={0}
          label="Your balance"
          value={formatCents(net, { signed: true })}
          hint={net > 0 ? "The household owes you" : net < 0 ? "You owe the household" : "You're all settled up"}
          icon={Wallet}
          tone={net > 0 ? "positive" : net < 0 ? "negative" : "neutral"}
        />
        <StatCard
          index={1}
          label="You owe"
          value={formatCents(iOwe)}
          hint={creditors.length ? `To ${creditors.join(", ")}` : "Nothing to pay"}
          icon={ArrowUpRight}
          tone={iOwe ? "negative" : "neutral"}
        />
        <StatCard
          index={2}
          label="Owed to you"
          value={formatCents(owedToMe)}
          hint={owedToMe ? `From ${ledger.simplified.filter((t) => t.to === user.id).length} roommate(s)` : "Nobody owes you"}
          icon={ArrowDownLeft}
          tone={owedToMe ? "positive" : "neutral"}
        />
        <StatCard
          index={3}
          label="Spent this month"
          value={formatCents(monthTotal)}
          hint={`${monthCount} expense${monthCount === 1 ? "" : "s"} in the household`}
          icon={CalendarDays}
          tone="primary"
        />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[1.25fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Who pays whom</CardTitle>
            <CardDescription>Simplified so the household needs fewer payments.</CardDescription>
            <CardAction>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/balances">Details</Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <TransferList transfers={ledger.simplified} />
          </CardContent>
        </Card>
        <Card className="lg:row-span-2">
          <CardHeader>
            <CardTitle>Balances</CardTitle>
            <CardDescription>Green gets money back, red owes.</CardDescription>
          </CardHeader>
          <CardContent>
            <MemberBalanceList detailed />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <CardAction>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/activity">See all</Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            {activity.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <span className="flex size-10 items-center justify-center rounded-full bg-accent text-accent-foreground">
                  <Receipt className="size-5" />
                </span>
                <p className="text-sm font-medium">No expenses yet</p>
                <p className="max-w-xs text-xs text-muted-foreground">Add your first shared expense — groceries, rent, the Wi-Fi bill.</p>
                <Button onClick={() => openAddExpense()}>Add an expense</Button>
              </div>
            ) : (
              <ActivityFeed items={activity} />
            )}
          </CardContent>
        </Card>
      </div>

      <Analytics />
    </div>
  );
}

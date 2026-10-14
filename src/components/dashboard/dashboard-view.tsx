"use client";

import { motion } from "framer-motion";
import { ArrowRight, Receipt } from "lucide-react";
import Link from "next/link";
import { MemberBalanceList } from "@/components/balances/member-balance-list";
import { TransferList } from "@/components/balances/transfer-list";
import { ActivityFeed } from "@/components/activity/activity-feed";
import { useAppData } from "@/components/providers/app-data-provider";
import { useDialogs } from "@/components/providers/dialogs-provider";
import { AnimatedMoney } from "@/components/shared/animated-money";
import { EmptyState } from "@/components/shared/empty-state";
import { PencilRing } from "@/components/shared/pencil-ring";
import { ScrambleText } from "@/components/shared/scramble-text";
import { NightPanel, StatRow, StatTile } from "@/components/shared/terminal-panel";
import { Mascot, SparkleDoodle } from "@/components/shared/doodles";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buildActivity } from "@/lib/activity";
import { spendingThisMonth } from "@/lib/analytics";
import { formatCents } from "@/lib/domain/money";
import { firstName } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Analytics } from "./analytics";

// Soft focus pull, like the section changes on an editorial landing page.
const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 10, filter: "blur(6px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)" },
  transition: { delay, duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
});

function CardLink({ href, children }: { href: string; children: string }) {
  return (
    <Button variant="ghost" size="sm" asChild className="group/link text-muted-foreground hover:text-foreground">
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
  const nameOf = (id: string) => (ledger.shortName.get(id) ?? "Former roommate");
  const creditors = myDebts.map((t) => nameOf(t.to));
  const debtors = myCredits.map((t) => nameOf(t.from));
  const tone = net > 0 ? "positive" : net < 0 ? "negative" : "neutral";
  const me = firstName(user.displayName);
  const activeMembers = snapshot.members.filter((m) => m.leftAt === null).length;
  // Paid toward your own share: expenses you fronted plus completed paybacks, capped at 100%.
  const mySummary = ledger.summaries.find((s) => s.userId === user.id);
  const coverage = mySummary && mySummary.shareCents > 0 ? Math.min(1, Math.max(0, 1 + net / mySummary.shareCents)) : 1;

  return (
    <div className="space-y-6 md:space-y-8">
      <section className="grid grid-cols-[minmax(0,1fr)] items-stretch gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.95fr)] lg:gap-7">
        <motion.div
          {...fadeUp()}
          className={cn(
            "relative overflow-hidden rounded-[28px] p-6 sticker sm:p-8",
            tone === "negative" ? "bg-blush" : tone === "positive" ? "bg-mint" : "bg-butter",
          )}
        >
          <Mascot
            mood={tone === "negative" ? "worried" : tone === "positive" ? "proud" : "happy"}
            className="pointer-events-none absolute -right-3 -bottom-3 h-36 animate-bob sm:h-44 lg:h-48"
          />
          <SparkleDoodle className="pointer-events-none absolute top-5 right-6 size-7 animate-wiggle [--wiggle-amount:18deg]" color="var(--pop-pink)" />
          <SparkleDoodle className="pointer-events-none absolute top-16 right-24 size-4 animate-wiggle [--wiggle-amount:-22deg] [--wiggle-duration:1.8s]" color="var(--card)" />
          <div className="relative space-y-5 pr-24 sm:pr-36">
            <span className="inline-flex items-center gap-2 rounded-full bg-card px-3 py-1 font-label text-foreground sticker-sm">
              {snapshot.household.name}
              <span aria-hidden className="text-[8px] text-foreground/60">■</span>
              {String(activeMembers).padStart(2, "0")}
            </span>
            <h2 className="font-display text-[2.9rem] leading-[0.95] tracking-[-0.015em] sm:text-7xl">
              <ScrambleText text={`Hey ${me},`} />
              <br />
              <span className="text-gradient">
                {net < 0 ? (
                  <>
                    you owe <span className="text-negative">
                      <AnimatedMoney cents={-net} />
                    </span>
                  </>
                ) : net > 0 ? (
                  <>
                    you&apos;re up <span className="text-positive">
                      <AnimatedMoney cents={net} flash={false} />
                    </span>
                  </>
                ) : (
                  <>
                    you&apos;re <em>all square</em>
                  </>
                )}
              </span>
            </h2>
            <p className="max-w-md text-[15px] leading-relaxed text-foreground/70">
              {net < 0
                ? `Pay ${creditors.join(" and ")} to get back to zero. Balances are simplified, so that's the fewest transfers we found.`
                : net > 0
                  ? `${debtors.join(" and ")} ${debtors.length === 1 ? "owes" : "owe"} you. Nudge them, or record it when the money lands.`
                  : "Nothing to pay and nothing to collect. Log the next grocery run and we'll keep the math honest."}
            </p>
            <div className="flex flex-wrap gap-3">
              <Button size="lg" mark="star" onClick={() => openAddExpense()}>
                Add expense
              </Button>
              <Button size="lg" variant="outline" mark="cross" onClick={() => openSettleUp()} className="bg-card">
                Settle up
              </Button>
            </div>
          </div>
        </motion.div>

        <motion.div {...fadeUp(0.08)}>
          <NightPanel
            className="h-full"
            eyebrow="Your share, covered"
            index={`${String(new Date().getMonth() + 1).padStart(2, "0")} / 12`}
            footer={
              <StatRow>
                <StatTile label="Balance" value={<AnimatedMoney cents={net} signed />} tone={tone} />
                <StatTile label="You owe" value={<AnimatedMoney cents={iOwe} />} tone={iOwe ? "negative" : "neutral"} />
                <StatTile label="Owed to you" value={<AnimatedMoney cents={owedToMe} />} tone={owedToMe ? "positive" : "neutral"} />
                <StatTile label="This month" value={<AnimatedMoney cents={monthTotal} />} hint={`${monthCount} expense${monthCount === 1 ? "" : "s"}`} />
              </StatRow>
            }
          >
            <PencilRing progress={coverage}>
              <p className="font-display text-[2.6rem] leading-none tabular-nums">{Math.round(coverage * 100)}%</p>
              <p className="mt-2 font-display text-lg leading-tight text-night-foreground/70 italic">of your share paid</p>
              <p className="mt-3 max-w-[11rem] font-label text-[9.5px] leading-relaxed text-night-foreground/45">
                Paid <span className="text-night-foreground/80">{formatCents(mySummary?.paidCents ?? 0)}</span> of{" "}
                <span className="text-night-foreground/80">{formatCents(mySummary?.shareCents ?? 0)}</span> so far
              </p>
            </PencilRing>
          </NightPanel>
        </motion.div>
      </section>

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 md:gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <motion.div {...fadeUp(0.12)}>
          <Card lift tone="sky" doodle="arrows">
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
          <Card lift tone="lilac" doodle="scale">
            <CardHeader>
              <CardTitle>Balances</CardTitle>
              <CardDescription>
                <span className="rounded-full bg-pop-green px-1.5 text-foreground">Green</span> gets money back, <span className="rounded-full bg-pop-pink px-1.5 text-foreground">pink</span> owes.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <MemberBalanceList detailed />
            </CardContent>
          </Card>
        </motion.div>
        <motion.div {...fadeUp(0.2)}>
          <Card lift doodle="receipt">
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
                    <Button mark="star" onClick={() => openAddExpense()}>
                      Add expense
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

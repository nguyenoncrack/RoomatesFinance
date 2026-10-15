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
import { ScrambleText } from "@/components/shared/scramble-text";
import { BillDoodle, DollarCoinDoodle, Mascot, SparkleDoodle } from "@/components/shared/doodles";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildActivity } from "@/lib/activity";
import { firstName } from "@/lib/format";
import { cn } from "@/lib/utils";
import { RepeatChips } from "@/components/expenses/repeat-chips";
import { Analytics } from "./analytics";
import { ReceiptPrinter } from "./receipt-printer";
import { SettleReminder } from "./settle-reminder";
import { ConfirmPaymentsCard } from "@/components/settlements/confirm-payments-card";

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
  const { openAddExpense, openSettleUp, openInvite } = useDialogs();
  if (!ledger || !snapshot || !user) return null;

  const net = ledger.balances.get(user.id) ?? 0;
  const activity = buildActivity(snapshot).slice(0, 6);
  const tone = net > 0 ? "positive" : net < 0 ? "negative" : "neutral";
  const me = firstName(user.displayName);
  const activeMembers = snapshot.members.filter((m) => m.leftAt === null).length;

  return (
    <div className="space-y-6 md:space-y-8">
      <SettleReminder />
      <ConfirmPaymentsCard />
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
          <span aria-hidden className="pointer-events-none absolute top-7 right-28 hidden h-11 w-[4.5rem] animate-bob [animation-delay:0.8s] sm:block">
            <BillDoodle className="size-full rotate-[-14deg] drop-shadow-[2px_2px_0_var(--foreground)]" />
          </span>
          <span aria-hidden className="pointer-events-none absolute top-24 right-6 h-10 w-16 animate-bob [animation-delay:1.6s]">
            <BillDoodle className="size-full rotate-[18deg] drop-shadow-[2px_2px_0_var(--foreground)]" />
          </span>
          <span aria-hidden className="pointer-events-none absolute right-44 bottom-6 hidden size-9 animate-bob [animation-delay:0.3s] lg:block">
            <DollarCoinDoodle className="size-full" />
          </span>
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
            <div className="flex flex-wrap gap-3">
              <Button variant="pop" doodle="receipt" onClick={() => openAddExpense()}>
                Add expense
              </Button>
              <Button variant="mint" doodle="dollar" onClick={() => openSettleUp()}>
                Settle up
              </Button>
              <Button variant="lilac" doodle="people" onClick={openInvite}>
                Invite
              </Button>
            </div>
          </div>
        </motion.div>

        <motion.div {...fadeUp(0.08)}>
          <ReceiptPrinter />
        </motion.div>
      </section>

      <motion.div {...fadeUp(0.1)}>
        <RepeatChips />
      </motion.div>

      <div className="grid grid-cols-[minmax(0,1fr)] items-stretch gap-5 lg:grid-cols-2">
        <motion.div {...fadeUp(0.12)} className="flex">
          <Card lift tone="sky" doodle="bill" className="flex-1">
            <CardHeader>
              <CardTitle>Who pays whom</CardTitle>
              <CardAction>
                <CardLink href="/balances">Details</CardLink>
              </CardAction>
            </CardHeader>
            <CardContent>
              <TransferList transfers={ledger.simplified} />
            </CardContent>
          </Card>
        </motion.div>
        <motion.div {...fadeUp(0.16)} className="flex">
          <Card lift tone="lilac" doodle="scale" className="flex-1">
            <CardHeader>
              <CardTitle>Balances</CardTitle>
            </CardHeader>
            <CardContent>
              <MemberBalanceList detailed />
            </CardContent>
          </Card>
        </motion.div>
        <motion.div {...fadeUp(0.2)} className="lg:col-span-2">
          <Card lift doodle="wallet">
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
                />
              ) : (
                <ActivityFeed items={activity} twoColumn />
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <Analytics />
    </div>
  );
}

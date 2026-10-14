"use client";

import { useEffect, useState } from "react";
import { useAppData } from "@/components/providers/app-data-provider";
import { useDialogs } from "@/components/providers/dialogs-provider";
import { ClockDoodle } from "@/components/shared/doodles";
import { Button } from "@/components/ui/button";
import { formatCents } from "@/lib/domain/money";
import { describeSchedule, settleReminder, type SettleSchedule } from "@/lib/domain/recurring";
import { todayDay } from "@/lib/format";

const dismissKey = (householdId: string, userId: string) => `roommate-finance:settle-dismissed:${householdId}:${userId}`;

function readDismissed(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Shown from the household's settle day until the end of that period, and only while you owe or
 * are owed money. "Later" hides it until the next settle day.
 */
export function SettleReminder() {
  const { snapshot, ledger, user } = useAppData();
  const { openSettleUp } = useDialogs();
  const [dismissed, setDismissed] = useState<string | null | undefined>(undefined);
  const householdId = snapshot?.household.id;
  const userId = user?.id;

  useEffect(() => {
    if (!householdId || !userId) return;
    // localStorage only exists in the browser, so this is read after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDismissed(readDismissed(dismissKey(householdId, userId)));
  }, [householdId, userId]);

  if (!snapshot || !ledger || !user || dismissed === undefined) return null;
  const { settleCadence, settleDay } = snapshot.household;
  const schedule: SettleSchedule | null = settleCadence && settleDay !== null ? { cadence: settleCadence, day: settleDay } : null;
  const net = ledger.balances.get(user.id) ?? 0;
  const { due, period } = settleReminder(todayDay(), schedule, net, dismissed);
  if (!due || !period || !schedule) return null;

  const nameOf = (id: string) => ledger.shortName.get(id) ?? "a roommate";
  const mine = net < 0 ? ledger.simplified.filter((t) => t.from === user.id) : ledger.simplified.filter((t) => t.to === user.id);
  const who = mine.map((t) => nameOf(net < 0 ? t.to : t.from)).join(" & ");

  function later() {
    try {
      window.localStorage.setItem(dismissKey(snapshot!.household.id, user!.id), period!);
    } catch {
      // Storage blocked: hide it for this visit only.
    }
    setDismissed(period!);
  }

  return (
    <div role="status" className="relative flex flex-wrap items-center gap-4 rounded-[22px] bg-tangerine px-5 py-4 sticker">
      <span aria-hidden className="animate-wiggle [--wiggle-amount:-10deg] [--wiggle-duration:1.8s]">
        <ClockDoodle className="size-12" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-display text-2xl leading-tight">Settle day!</p>
        <p className="font-hand text-lg leading-tight text-foreground/75">
          {net < 0 ? `You owe ${who} ${formatCents(-net)}` : `${who} ${mine.length === 1 ? "owes" : "owe"} you ${formatCents(net)}`} ·{" "}
          {describeSchedule(schedule).toLowerCase()}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" onClick={later}>
          Later
        </Button>
        <Button
          variant="mint"
          doodle="dollar"
          onClick={() =>
            openSettleUp(
              mine.length === 1
                ? { direction: net < 0 ? "pay" : "receive", counterpartyId: net < 0 ? mine[0].to : mine[0].from, amountCents: mine[0].amountCents }
                : undefined,
            )
          }
        >
          Settle up
        </Button>
      </div>
    </div>
  );
}

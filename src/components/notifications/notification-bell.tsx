"use client";

import { formatDistanceToNowStrict, parseISO } from "date-fns";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useAppData } from "@/components/providers/app-data-provider";
import { celebrate } from "@/components/shared/celebration";
import { MemberAvatar } from "@/components/shared/member-avatar";
import { ConfirmButtons, notificationText, useConfirmPayment } from "@/components/settlements/confirm";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatCents } from "@/lib/domain/money";
import { cn } from "@/lib/utils";

/** Hand-drawn bell; it rings (wiggles) while something is unread. */
function BellDoodle({ ringing }: { ringing: boolean }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-6 overflow-visible", ringing && "animate-wiggle [--wiggle-amount:14deg] [--wiggle-duration:0.9s]")} aria-hidden>
      <path
        d="M16 5c-5 0-8 3.6-8 8.5v4.2L5.6 22c-.5.9.1 1.9 1.1 1.9h18.6c1 0 1.6-1 1.1-1.9L24 17.7v-4.2C24 8.6 21 5 16 5z"
        fill="var(--pop-yellow)"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <path d="M12.5 24.5c.6 1.9 1.9 3 3.5 3s2.9-1.1 3.5-3" fill="var(--pop-orange)" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
      <path d="M16 2.6v2.6" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
      <path d="M11 10.5c.7-1.6 1.9-2.6 3.4-3" stroke="white" strokeWidth={1.6} strokeLinecap="round" fill="none" opacity={0.8} />
    </svg>
  );
}

/**
 * Header bell for settlement notifications. New ones that arrive while the app is open also pop a
 * toast; a payment request toast carries Accept / Reject right there.
 */
export function NotificationBell() {
  const { notifications, snapshot, ledger, user, markNotificationsRead } = useAppData();
  const { respond } = useConfirmPayment();
  const [open, setOpen] = useState(false);
  const seen = useRef<Set<string> | null>(null);
  const respondRef = useRef(respond);
  useEffect(() => {
    respondRef.current = respond;
  });

  const name = (id: string | null) => (id === user?.id ? "You" : id ? (ledger?.shortName.get(id) ?? "A roommate") : "Someone");
  const settlementById = new Map(snapshot?.settlements.map((s) => [s.id, s]) ?? []);
  const unread = notifications.filter((n) => n.readAt === null);

  // Toast anything that arrives after the first load. The first load just seeds what's been seen.
  useEffect(() => {
    if (!snapshot) return;
    if (seen.current === null) {
      seen.current = new Set(notifications.map((n) => n.id));
      return;
    }
    for (const n of notifications) {
      if (seen.current.has(n.id)) continue;
      seen.current.add(n.id);
      if (n.readAt !== null) continue;
      const text = notificationText(n, name);
      const settlement = n.settlementId ? snapshot.settlements.find((s) => s.id === n.settlementId) : undefined;
      if (n.kind === "settlement_requested" && settlement?.status === "pending") {
        toast(text, {
          description: "Confirm once the money arrives.",
          duration: 12000,
          action: { label: "Accept", onClick: () => void respondRef.current(settlement, true) },
          cancel: { label: "Reject", onClick: () => void respondRef.current(settlement, false) },
        });
      } else if (n.kind === "settlement_accepted") {
        toast.success(text, { description: "Balances updated." });
        celebrate("Payment confirmed", { subtitle: n.amountCents === null ? undefined : formatCents(n.amountCents), priority: 1 });
      } else {
        toast(text);
      }
    }
    // `name` reads from ledger/user, which change together with notifications.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifications, snapshot]);

  function onOpenChange(next: boolean) {
    setOpen(next);
    // Opening the bell reads everything except requests you still need to answer.
    if (next) {
      const ids = unread
        .filter((n) => !(n.kind === "settlement_requested" && n.settlementId && settlementById.get(n.settlementId)?.status === "pending"))
        .map((n) => n.id);
      if (ids.length) void markNotificationsRead(ids);
    }
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={unread.length ? `Notifications, ${unread.length} unread` : "Notifications"}
          className="relative grid size-9 shrink-0 place-items-center rounded-full bg-butter text-foreground sticker-sm transition-[translate,box-shadow] hover:-translate-y-0.5 hover:shadow-[3px_4px_0_0_var(--foreground)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
        >
          <BellDoodle ringing={unread.length > 0} />
          {unread.length ? (
            <span className="absolute -top-1.5 -right-1.5 z-[3] grid h-5 min-w-5 place-items-center rounded-full bg-pop-pink px-1 font-hand text-sm leading-none text-foreground sketch-line">
              {unread.length > 9 ? "9+" : unread.length}
            </span>
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[22rem] rounded-2xl bg-card p-0 sticker">
        <div className="border-b px-4 py-3">
          <p className="font-display text-2xl leading-none">Notifications</p>
        </div>
        {notifications.length === 0 ? (
          <p className="px-4 py-6 text-center font-hand text-lg text-muted-foreground">All caught up</p>
        ) : (
          <ul className="max-h-96 divide-y overflow-y-auto">
            {notifications.map((n) => {
              const settlement = n.settlementId ? settlementById.get(n.settlementId) : undefined;
              const actionable = n.kind === "settlement_requested" && settlement?.status === "pending" && settlement.paidTo === user?.id;
              return (
                <li key={n.id} className={cn("flex gap-3 px-4 py-3", n.readAt === null && "bg-butter/40")}>
                  {n.actorId ? <MemberAvatar id={n.actorId} name={name(n.actorId)} size="sm" className="mt-0.5" /> : null}
                  <div className="min-w-0 flex-1">
                    <p className="font-hand text-lg leading-tight">{notificationText(n, name)}</p>
                    <p className="font-label text-[9.5px] text-muted-foreground">
                      {formatDistanceToNowStrict(parseISO(n.createdAt), { addSuffix: true })}
                      {n.kind === "settlement_requested" && settlement && settlement.status !== "pending" ? ` · ${settlement.status}` : ""}
                    </p>
                    {actionable && settlement ? <ConfirmButtons settlement={settlement} size="xs" className="mt-2" /> : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}

"use client";

import { Check, Loader2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useAppData } from "@/components/providers/app-data-provider";
import { celebrate } from "@/components/shared/celebration";
import { Button } from "@/components/ui/button";
import { formatCents } from "@/lib/domain/money";
import type { AppNotification, Settlement } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

/** Where a settlement stands from the signed-in person's side. */
export function settlementRole(s: Settlement, userId: string | undefined) {
  const incoming = s.status === "pending" && s.paidTo === userId;
  const awaiting = s.status === "pending" && s.paidBy === userId;
  return { incoming, awaiting };
}

/** Accept/reject for the recipient, with the toasts and confetti that go with each. */
export function useConfirmPayment() {
  const { setSettlementStatus, ledger } = useAppData();
  const [busy, setBusy] = useState<string | null>(null);
  const name = (id: string) => ledger?.shortName.get(id) ?? "your roommate";

  async function respond(s: Pick<Settlement, "id" | "paidBy" | "amountCents">, accept: boolean) {
    setBusy(`${s.id}:${accept ? "accept" : "reject"}`);
    try {
      await setSettlementStatus(s.id, accept ? "completed" : "rejected");
      if (accept) {
        toast.success(`Confirmed ${formatCents(s.amountCents)} from ${name(s.paidBy)}`, { description: "Balances updated." });
        celebrate("Payment confirmed", { subtitle: `${formatCents(s.amountCents)} from ${name(s.paidBy)}`, priority: 1 });
      } else {
        toast(`Rejected ${formatCents(s.amountCents)} from ${name(s.paidBy)}`, { description: "Balances stay the same." });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't update the payment.");
    } finally {
      setBusy(null);
    }
  }

  return { respond, busy };
}

export function ConfirmButtons({
  settlement,
  size = "sm",
  className,
}: {
  settlement: Pick<Settlement, "id" | "paidBy" | "amountCents">;
  size?: "xs" | "sm" | "default";
  className?: string;
}) {
  const { respond, busy } = useConfirmPayment();
  const accepting = busy === `${settlement.id}:accept`;
  const rejecting = busy === `${settlement.id}:reject`;
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Button size={size} variant="ghost" onClick={() => respond(settlement, false)} disabled={busy !== null}>
        {rejecting ? <Loader2 className="animate-spin" /> : <X />} Reject
      </Button>
      <Button size={size} variant="mint" onClick={() => respond(settlement, true)} disabled={busy !== null}>
        {accepting ? <Loader2 className="animate-spin" /> : <Check />} Accept
      </Button>
    </div>
  );
}

/** Human sentence for a notification. */
export function notificationText(n: AppNotification, name: (id: string | null) => string): string {
  const amount = n.amountCents === null ? "a payment" : formatCents(n.amountCents);
  const who = name(n.actorId);
  switch (n.kind) {
    case "settlement_requested":
      return `${who} says they paid you ${amount}`;
    case "settlement_accepted":
      return `${who} confirmed your ${amount} payment`;
    case "settlement_rejected":
      return `${who} rejected your ${amount} payment`;
    case "settlement_cancelled":
      return `${who} cancelled a ${amount} payment`;
  }
}

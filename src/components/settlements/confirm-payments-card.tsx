"use client";

import { ArrowRight } from "lucide-react";
import { useAppData } from "@/components/providers/app-data-provider";
import { MemberAvatar } from "@/components/shared/member-avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCents } from "@/lib/domain/money";
import { PAYMENT_METHOD_LABELS } from "@/lib/domain/types";
import { ConfirmButtons } from "./confirm";

/** Payments roommates say they sent you, waiting for you to accept or reject. Hidden when there are none. */
export function ConfirmPaymentsCard() {
  const { snapshot, ledger, user } = useAppData();
  if (!snapshot || !ledger || !user) return null;
  const incoming = snapshot.settlements.filter((s) => s.status === "pending" && s.paidTo === user.id && !s.id.startsWith("optimistic-"));
  if (incoming.length === 0) return null;
  const name = (id: string) => ledger.shortName.get(id) ?? "A roommate";

  return (
    <Card tone="butter" doodle="dollar">
      <CardHeader>
        <CardTitle>Confirm payments</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {incoming.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
              <div className="flex items-center -space-x-1.5">
                <MemberAvatar id={s.paidBy} name={name(s.paidBy)} className="ring-2 ring-butter" />
                <MemberAvatar id={user.id} name={user.displayName} className="ring-2 ring-butter" />
              </div>
              <p className="min-w-0 flex-1 font-hand text-lg leading-tight">
                {name(s.paidBy)} <ArrowRight className="mx-1 inline size-3.5 text-muted-foreground" /> you
                <span className="block text-[15px] text-muted-foreground">
                  {PAYMENT_METHOD_LABELS[s.paymentMethod]}
                  {s.note ? ` · “${s.note}”` : ""}
                </span>
              </p>
              <span className="font-hand text-xl leading-none">{formatCents(s.amountCents)}</span>
              <ConfirmButtons settlement={s} />
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

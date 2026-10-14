"use client";

import { ArrowRight, CircleCheck } from "lucide-react";
import { motion } from "framer-motion";
import { useAppData } from "@/components/providers/app-data-provider";
import { useDialogs } from "@/components/providers/dialogs-provider";
import { MemberAvatar } from "@/components/shared/member-avatar";
import { Button } from "@/components/ui/button";
import type { Transfer } from "@/lib/domain/balances";
import { formatCents } from "@/lib/domain/money";
import { firstName } from "@/lib/format";
import { cn } from "@/lib/utils";

export function TransferList({ transfers, emptyText, compact }: { transfers: Transfer[]; emptyText?: string; compact?: boolean }) {
  const { ledger, user } = useAppData();
  const { openSettleUp } = useDialogs();
  if (!ledger) return null;

  if (transfers.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center">
        <span className="flex size-10 items-center justify-center rounded-full bg-positive-soft text-positive">
          <CircleCheck className="size-5" />
        </span>
        <p className="text-sm font-medium">Everyone&apos;s square</p>
        <p className="text-xs text-muted-foreground">{emptyText ?? "No payments needed right now."}</p>
      </div>
    );
  }

  const name = (id: string) => (id === user?.id ? "You" : firstName(ledger.memberById.get(id)?.displayName ?? "Former roommate"));

  return (
    <ul className="space-y-2">
      {transfers.map((t, i) => {
        const fromMe = t.from === user?.id;
        const toMe = t.to === user?.id;
        const from = ledger.memberById.get(t.from);
        const to = ledger.memberById.get(t.to);
        return (
          <motion.li
            key={`${t.from}-${t.to}`}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
            className={cn(
              "flex items-center gap-3 rounded-xl border px-3 py-2.5",
              fromMe && "border-negative/20 bg-negative-soft/50",
              toMe && "border-positive/20 bg-positive-soft/50",
            )}
          >
            <div className="flex items-center -space-x-1.5">
              <MemberAvatar id={t.from} name={from?.displayName ?? "?"} src={from?.avatarUrl} className="ring-2 ring-card" />
              <MemberAvatar id={t.to} name={to?.displayName ?? "?"} src={to?.avatarUrl} className="ring-2 ring-card" />
            </div>
            <p className="min-w-0 flex-1 text-sm">
              <span className="font-semibold">{name(t.from)}</span>
              <ArrowRight className="mx-1.5 inline size-3.5 text-muted-foreground" />
              <span className="font-semibold">{name(t.to)}</span>
              {compact ? null : <span className="block text-xs text-muted-foreground">{fromMe ? "You pay" : toMe ? "Pays you" : "Pays"}</span>}
            </p>
            <span className={cn("text-sm font-semibold tabular-nums", fromMe ? "text-negative" : toMe ? "text-positive" : "")}>
              {formatCents(t.amountCents)}
            </span>
            {fromMe || toMe ? (
              <Button
                size="sm"
                variant={fromMe ? "default" : "outline"}
                onClick={() =>
                  openSettleUp({ direction: fromMe ? "pay" : "receive", counterpartyId: fromMe ? t.to : t.from, amountCents: t.amountCents })
                }
              >
                {fromMe ? "Settle" : "Record"}
              </Button>
            ) : null}
          </motion.li>
        );
      })}
    </ul>
  );
}

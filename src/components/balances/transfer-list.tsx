"use client";

import { ArrowRight, CircleCheck } from "lucide-react";
import { motion } from "framer-motion";
import { useAppData } from "@/components/providers/app-data-provider";
import { useDialogs } from "@/components/providers/dialogs-provider";
import { EmptyState } from "@/components/shared/empty-state";
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
      <EmptyState icon={CircleCheck} tone="positive" title="Everyone's square">
        {emptyText ?? "No payments needed right now."}
      </EmptyState>
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
            transition={{ delay: i * 0.04, duration: 0.25 }}
            className={cn(
              "flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-3 transition-colors hover:border-white/[0.12] hover:bg-white/[0.04]",
              fromMe && "border-negative/25 bg-negative-soft hover:border-negative/40 hover:bg-negative-soft",
              toMe && "border-positive/25 bg-positive-soft hover:border-positive/40 hover:bg-positive-soft",
            )}
          >
            <div className="flex items-center -space-x-1.5">
              <MemberAvatar id={t.from} name={from?.displayName ?? "?"} src={from?.avatarUrl} className="ring-2 ring-background" />
              <MemberAvatar id={t.to} name={to?.displayName ?? "?"} src={to?.avatarUrl} className="ring-2 ring-background" />
            </div>
            <p className="min-w-0 flex-1 text-sm">
              <span className="font-semibold">{name(t.from)}</span>
              <ArrowRight className="mx-1.5 inline size-3.5 text-muted-foreground" />
              <span className="font-semibold">{name(t.to)}</span>
              {compact ? null : <span className="block text-xs text-muted-foreground">{fromMe ? "You pay" : toMe ? "Pays you" : "Pays"}</span>}
            </p>
            <span className={cn("font-mono text-sm font-semibold tabular-nums", fromMe ? "text-negative" : toMe ? "text-positive" : "text-foreground/90")}>
              {formatCents(t.amountCents)}
            </span>
            {fromMe || toMe ? (
              <Button
                size="sm"
                variant={fromMe ? "default" : "outline"}
                className={cn("rounded-full px-3", fromMe && "glow-primary")}
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

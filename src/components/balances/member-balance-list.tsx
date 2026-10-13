"use client";

import { useAppData } from "@/components/providers/app-data-provider";
import { MemberAvatar } from "@/components/shared/member-avatar";
import { BalanceAmount, balanceLabel } from "@/components/shared/money";
import { Badge } from "@/components/ui/badge";
import { formatCents } from "@/lib/domain/money";
import { cn } from "@/lib/utils";

export function MemberBalanceList({ detailed }: { detailed?: boolean }) {
  const { ledger, user } = useAppData();
  if (!ledger) return null;
  const max = Math.max(1, ...ledger.summaries.map((s) => Math.abs(s.netCents)));
  const rows = [...ledger.summaries].sort((a, b) => b.netCents - a.netCents);

  return (
    <ul className="divide-y">
      {rows.map((s) => {
        const m = ledger.memberById.get(s.userId);
        const name = m?.displayName ?? "Former roommate";
        const pct = (Math.abs(s.netCents) / max) * 100;
        return (
          <li key={s.userId} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
            <MemberAvatar id={s.userId} name={name} src={m?.avatarUrl} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-medium">{name}</p>
                {s.userId === user?.id ? <Badge variant="secondary">You</Badge> : null}
                {m?.leftAt ? <Badge variant="outline">Left</Badge> : null}
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn("h-full rounded-full transition-all", s.netCents > 0 ? "bg-positive" : s.netCents < 0 ? "bg-negative" : "bg-muted")}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
              {detailed ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Paid {formatCents(s.paidCents)} · Share {formatCents(s.shareCents)}
                </p>
              ) : null}
            </div>
            <div className="w-28 text-right">
              <BalanceAmount cents={s.netCents} className="block text-sm" />
              <span className="text-[11px] text-muted-foreground">{balanceLabel(s.netCents)}</span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

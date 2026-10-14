"use client";

import { useMemo } from "react";
import { useAppData } from "@/components/providers/app-data-provider";
import { CATEGORY_META } from "@/components/shared/category";
import { Ticker, type TickerItem } from "@/components/shared/ticker";
import { formatCents } from "@/lib/domain/money";
import { firstName } from "@/lib/format";
import { buildTicker } from "@/lib/ticker";

export function ActivityTicker({ className }: { className?: string }) {
  const { snapshot, ledger, user } = useAppData();
  const items = useMemo<TickerItem[]>(() => {
    if (!snapshot || !ledger) return [];
    const name = (id: string) => (id === user?.id ? "You" : firstName(ledger.memberById.get(id)?.displayName ?? "Former roommate"));
    return buildTicker(snapshot, user?.id ?? null).map((e) => {
      if (e.kind === "settlement") {
        return {
          id: e.id,
          trend: e.trend,
          label: (
            <>
              <b className="font-semibold">{name(e.fromId)}</b> paid <b className="font-semibold">{name(e.toId) === "You" ? "you" : name(e.toId)}</b>
              {e.pending ? <span className="text-muted-foreground"> · pending</span> : null}
            </>
          ),
          value: formatCents(e.amountCents),
        };
      }
      const Icon = CATEGORY_META[e.category].icon;
      return {
        id: e.id,
        trend: e.trend,
        icon: <Icon className="size-3.5 text-muted-foreground" />,
        label: (
          <>
            <b className="font-semibold">{name(e.payerId)}</b> · {e.title}
          </>
        ),
        value: e.deltaCents ? formatCents(e.deltaCents, { signed: true }) : formatCents(e.amountCents),
      };
    });
  }, [snapshot, ledger, user]);

  return <Ticker items={items} label="Recent household money movements" className={className} />;
}

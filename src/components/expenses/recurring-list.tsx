"use client";

import { format, parseISO } from "date-fns";
import { Loader2, Square } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useAppData } from "@/components/providers/app-data-provider";
import { CategoryIcon } from "@/components/shared/category";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCents } from "@/lib/domain/money";

/** Repeating expenses for the household, with the next date each will be added and a way to stop it. */
export function RecurringCard() {
  const { snapshot, ledger, user, stopRecurring } = useAppData();
  const [stopping, setStopping] = useState<string | null>(null);
  if (!snapshot || !ledger || !user || snapshot.recurring.length === 0) return null;

  const isOwner = ledger.memberById.get(user.id)?.role === "owner";
  const name = (id: string) => (id === user.id ? "You" : (ledger.shortName.get(id) ?? "Former roommate"));

  async function stop(id: string, title: string) {
    setStopping(id);
    try {
      await stopRecurring(id);
      toast.success(`${title} won't repeat anymore`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't stop it.");
    } finally {
      setStopping(null);
    }
  }

  return (
    <Card tone="mint" doodle="clock">
      <CardHeader>
        <CardTitle>Repeats</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {snapshot.recurring.map((r) => {
            const canStop = r.createdBy === user.id || r.paidBy === user.id || isOwner;
            return (
              <li key={r.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <CategoryIcon category={r.category} />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 font-hand text-lg leading-tight">
                    <span className="truncate">{r.title}</span>
                    <Badge variant="secondary">{r.cadence}</Badge>
                  </p>
                  <p className="font-hand text-[15px] leading-tight text-muted-foreground">
                    {r.paidBy === user.id ? "You pay" : `${name(r.paidBy)} pays`} · next {format(parseISO(r.nextDate), "EEE, MMM d")}
                  </p>
                </div>
                <span className="font-hand text-xl leading-none">{formatCents(r.amountCents)}</span>
                {canStop ? (
                  <Button variant="ghost" size="sm" onClick={() => stop(r.id, r.title)} disabled={stopping === r.id} aria-label={`Stop repeating ${r.title}`}>
                    {stopping === r.id ? <Loader2 className="animate-spin" /> : <Square />} Stop
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

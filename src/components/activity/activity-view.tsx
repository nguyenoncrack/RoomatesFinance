"use client";

import { useMemo, useState } from "react";
import { useAppData } from "@/components/providers/app-data-provider";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { buildActivity } from "@/lib/activity";
import { formatCents } from "@/lib/domain/money";
import { ActivityFeed } from "./activity-feed";

type Filter = "all" | "expenses" | "payments" | "pending" | "changes";

export function ActivityView() {
  const { snapshot } = useAppData();
  const [filter, setFilter] = useState<Filter>("all");
  const all = useMemo(() => (snapshot ? buildActivity(snapshot) : []), [snapshot]);
  if (!snapshot) return null;

  const items = all.filter((i) => {
    if (filter === "expenses") return i.kind === "expense";
    if (filter === "payments") return i.kind === "settlement";
    if (filter === "pending") return i.kind === "settlement" && i.settlement.status === "pending";
    if (filter === "changes") return i.kind === "audit";
    return true;
  });
  const pending = snapshot.settlements.filter((s) => s.status === "pending");
  const settledTotal = snapshot.settlements.filter((s) => s.status === "completed").reduce((a, s) => a + s.amountCents, 0);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight md:hidden">Activity</h2>
        <p className="text-sm text-muted-foreground">
          {formatCents(settledTotal)} reimbursed so far · {pending.length} pending payment{pending.length === 1 ? "" : "s"}
        </p>
      </div>
      <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
        <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="pending">Pending{pending.length ? ` (${pending.length})` : ""}</TabsTrigger>
          <TabsTrigger value="changes">Edits</TabsTrigger>
        </TabsList>
      </Tabs>
      <Card className="py-2">
        <CardContent className="px-2">
          {items.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              {filter === "pending" ? "No pending payments — nice." : "Nothing here yet."}
            </p>
          ) : (
            <ActivityFeed items={items} showActions />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

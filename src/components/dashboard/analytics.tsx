"use client";

import { format, startOfMonth, subMonths } from "date-fns";
import { useMemo, useState } from "react";
import { ChartPie, Users } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAppData } from "@/components/providers/app-data-provider";
import { CATEGORY_META } from "@/components/shared/category";
import { EmptyState } from "@/components/shared/empty-state";
import { TabPill } from "@/components/shared/tab-pill";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { byCategory, contributions, monthlyTrend } from "@/lib/analytics";
import { formatCents } from "@/lib/domain/money";
import { CATEGORY_LABELS } from "@/lib/domain/types";
import { firstName } from "@/lib/format";

const compactUsd = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(cents / 100);

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; name?: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-white/10 bg-popover/95 px-2.5 py-1.5 text-xs shadow-xl shadow-black/50 backdrop-blur">
      {label ? <p className="font-medium">{label}</p> : null}
      {payload.map((p, i) => (
        <p key={i} className="font-mono tabular-nums text-muted-foreground">
          {p.name ? `${p.name}: ` : ""}
          {formatCents(p.value)}
        </p>
      ))}
    </div>
  );
}

export function Analytics() {
  const { snapshot, user } = useAppData();
  const [range, setRange] = useState<"month" | "6m">("6m");
  const expenses = useMemo(() => snapshot?.expenses ?? [], [snapshot]);
  const since = format(range === "month" ? startOfMonth(new Date()) : startOfMonth(subMonths(new Date(), 5)), "yyyy-MM-dd");

  const trend = useMemo(() => monthlyTrend(expenses), [expenses]);
  const categories = useMemo(() => byCategory(expenses, since), [expenses, since]);
  const total = categories.reduce((a, c) => a + c.cents, 0);
  const people = useMemo(() => {
    const byId = new Map(snapshot?.members.map((m) => [m.id, m]));
    return contributions(expenses, since)
      .map((c) => ({ ...c, name: c.userId === user?.id ? "You" : firstName(byId.get(c.userId)?.displayName ?? "Former") }))
      .sort((a, b) => b.paidCents - a.paidCents);
  }, [expenses, since, snapshot, user]);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold tracking-tight">Spending insights</h2>
          <p className="text-xs text-muted-foreground">Where the household&apos;s money goes.</p>
        </div>
        <ToggleGroup type="single" size="sm" variant="outline" value={range} onValueChange={(v) => v && setRange(v as "month" | "6m")}>
          <ToggleGroupItem value="month" className="relative isolate px-3 text-xs data-[state=on]:bg-transparent data-[state=on]:text-accent-foreground">
            {range === "month" ? <TabPill group="analytics-range" /> : null}
            This month
          </ToggleGroupItem>
          <ToggleGroupItem value="6m" className="relative isolate px-3 text-xs data-[state=on]:bg-transparent data-[state=on]:text-accent-foreground">
            {range === "6m" ? <TabPill group="analytics-range" /> : null}
            6 months
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      <div className="stagger-children grid gap-4 lg:grid-cols-3">
        <Card lift className="lg:col-span-1">
          <CardHeader>
            <CardTitle>By category</CardTitle>
            <CardDescription className="font-mono">{formatCents(total)} total</CardDescription>
          </CardHeader>
          <CardContent>
            {categories.length === 0 ? (
              <EmptyState icon={ChartPie} tone="neutral" title="Nothing spent yet" className="py-6">
                Expenses in this period will show up here by category.
              </EmptyState>
            ) : (
              <div className="flex items-center gap-4">
                <div className="size-32 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={categories} dataKey="cents" nameKey="category" innerRadius="62%" outerRadius="100%" paddingAngle={3} cornerRadius={4} stroke="none">
                        {categories.map((c) => (
                          <Cell key={c.category} fill={CATEGORY_META[c.category].chart} />
                        ))}
                      </Pie>
                      <Tooltip content={<ChartTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className="min-w-0 flex-1 space-y-1.5 text-xs">
                  {categories.slice(0, 6).map((c) => (
                    <li key={c.category} className="flex items-center gap-2">
                      <span className="size-2 shrink-0 rounded-full" style={{ background: CATEGORY_META[c.category].chart }} />
                      <span className="flex-1 truncate">{CATEGORY_LABELS[c.category]}</span>
                      <span className="font-medium tabular-nums">{Math.round((c.cents / total) * 100)}%</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        <Card lift>
          <CardHeader>
            <CardTitle>Monthly spending</CardTitle>
            <CardDescription>Household total, last 6 months</CardDescription>
          </CardHeader>
          <CardContent className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trend} margin={{ top: 4, right: 0, left: -12, bottom: 0 }}>
                <defs>
                  <linearGradient id="bar-green" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={1} />
                    <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.25} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 4" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} stroke="var(--muted-foreground)" />
                <YAxis tickLine={false} axisLine={false} fontSize={11} tickFormatter={compactUsd} stroke="var(--muted-foreground)" width={48} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "oklch(1 0 0 / 4%)" }} />
                <Bar dataKey="cents" fill="url(#bar-green)" radius={[6, 6, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card lift>
          <CardHeader>
            <CardTitle>Who paid what</CardTitle>
            <CardDescription>Paid vs. their share</CardDescription>
          </CardHeader>
          <CardContent className="h-44 min-h-44">
            {people.length === 0 ? (
              <EmptyState icon={Users} tone="neutral" title="No one has paid yet" className="py-6">
                Contributions appear once someone logs an expense.
              </EmptyState>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={people} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }} barGap={2}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} fontSize={11} width={56} stroke="var(--muted-foreground)" />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: "oklch(1 0 0 / 4%)" }} />
                  <Bar dataKey="paidCents" name="Paid" fill="var(--chart-1)" radius={[0, 4, 4, 0]} barSize={8} />
                  <Bar dataKey="shareCents" name="Share" fill="var(--chart-7)" radius={[0, 4, 4, 0]} barSize={8} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

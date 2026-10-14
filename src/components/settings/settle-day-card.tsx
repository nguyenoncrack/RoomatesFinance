"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useAppData } from "@/components/providers/app-data-provider";
import { TabPill } from "@/components/shared/tab-pill";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { WEEKDAY_LABELS, describeSchedule, nextSettleDay, ordinal, type Cadence } from "@/lib/domain/recurring";
import { todayDay } from "@/lib/format";
import { format, parseISO } from "date-fns";

type Choice = "off" | Cadence;

/** Owner picks an optional weekly or monthly settle day; everyone sees when the next one is. */
export function SettleDayCard() {
  const { snapshot, ledger, user, setSettleSchedule } = useAppData();
  const household = snapshot?.household;
  const [choice, setChoice] = useState<Choice>(household?.settleCadence ?? "off");
  const [weekday, setWeekday] = useState(household?.settleCadence === "weekly" ? (household.settleDay ?? 0) : 0);
  const [monthDay, setMonthDay] = useState(household?.settleCadence === "monthly" ? (household.settleDay ?? 1) : 1);
  const [saving, setSaving] = useState(false);
  if (!household || !ledger || !user) return null;

  const isOwner = ledger.memberById.get(user.id)?.role === "owner";
  const current = household.settleCadence && household.settleDay !== null ? { cadence: household.settleCadence, day: household.settleDay } : null;
  const draft = choice === "off" ? null : { cadence: choice, day: choice === "weekly" ? weekday : monthDay };
  const unchanged = JSON.stringify(draft) === JSON.stringify(current);

  async function save() {
    setSaving(true);
    try {
      await setSettleSchedule(draft);
      toast.success(draft ? `Settle day: ${describeSchedule(draft).toLowerCase()}` : "Settle day turned off");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save the settle day.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card tone="tangerine" doodle="clock">
      <CardHeader>
        <CardTitle>Settle day</CardTitle>
        <CardDescription className="font-hand text-lg text-foreground/70">
          {current
            ? `${describeSchedule(current)} · next ${format(parseISO(nextSettleDay(todayDay(), current)), "EEE, MMM d")}`
            : "Off"}
        </CardDescription>
      </CardHeader>
      {isOwner ? (
        <>
          <CardContent className="space-y-3">
            <ToggleGroup type="single" variant="outline" size="sm" value={choice} onValueChange={(v) => v && setChoice(v as Choice)} aria-label="Settle day">
              {(["off", "weekly", "monthly"] as const).map((c) => (
                <ToggleGroupItem key={c} value={c} className="relative isolate px-3 capitalize data-[state=on]:bg-transparent data-[state=on]:text-foreground">
                  {choice === c ? <TabPill group="settle-day" /> : null}
                  {c}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            {choice === "weekly" ? (
              <Select value={String(weekday)} onValueChange={(v) => setWeekday(Number(v))}>
                <SelectTrigger className="h-10 w-48 rounded-xl bg-card" aria-label="Weekday">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WEEKDAY_LABELS.map((label, i) => (
                    <SelectItem key={label} value={String(i)}>
                      Every {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : choice === "monthly" ? (
              <Select value={String(monthDay)} onValueChange={(v) => setMonthDay(Number(v))}>
                <SelectTrigger className="h-10 w-48 rounded-xl bg-card" aria-label="Day of month">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                    <SelectItem key={d} value={String(d)}>
                      The {ordinal(d)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
          </CardContent>
          <CardFooter className="mt-1 bg-transparent">
            <Button variant="pop" size="sm" onClick={save} disabled={saving || unchanged}>
              {saving ? <Loader2 className="animate-spin" /> : null} Save
            </Button>
          </CardFooter>
        </>
      ) : null}
    </Card>
  );
}

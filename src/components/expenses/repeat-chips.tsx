"use client";

import { RotateCcw } from "lucide-react";
import { useMemo } from "react";
import { useAppData } from "@/components/providers/app-data-provider";
import { useDialogs } from "@/components/providers/dialogs-provider";
import { CATEGORY_META } from "@/components/shared/category";
import type { Expense } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

/** The most recent expense for each distinct title, newest first. */
function recentDistinct(expenses: Expense[], limit: number): Expense[] {
  const seen = new Set<string>();
  const out: Expense[] = [];
  const sorted = [...expenses].sort((a, b) => b.expenseDate.localeCompare(a.expenseDate) || b.createdAt.localeCompare(a.createdAt));
  for (const e of sorted) {
    const key = e.title.trim().toLowerCase();
    if (seen.has(key) || e.id.startsWith("optimistic-")) continue;
    seen.add(key);
    out.push(e);
    if (out.length === limit) break;
  }
  return out;
}

/**
 * One tap to add a recent expense again ("Groceries again"): opens the form with the same title,
 * amount, payer and split already filled in, dated today.
 */
export function RepeatChips({ limit = 4, className }: { limit?: number; className?: string }) {
  const { snapshot } = useAppData();
  const { openRepeatExpense } = useDialogs();
  const recent = useMemo(() => recentDistinct(snapshot?.expenses ?? [], limit), [snapshot, limit]);
  if (recent.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-2.5", className)}>
      <span className="flex items-center gap-1.5 font-label text-muted-foreground">
        <RotateCcw className="size-3.5" strokeWidth={2} /> Add again
      </span>
      {recent.map((e, i) => {
        const Icon = CATEGORY_META[e.category].icon;
        return (
          <button
            key={e.id}
            type="button"
            onClick={() => openRepeatExpense(e)}
            className={cn(
              "group/chip flex items-center gap-2 rounded-full py-1 pr-3.5 pl-1 font-hand text-lg leading-none sticker-sm transition-[translate,box-shadow] hover:-translate-y-0.5 hover:shadow-[3px_4px_0_0_var(--foreground)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
              ["bg-butter", "bg-mint", "bg-blush", "bg-sky"][i % 4],
            )}
          >
            <span className={cn("grid size-7 place-items-center rounded-full sketch-line transition-transform group-hover/chip:-rotate-12", CATEGORY_META[e.category].tone)}>
              <Icon className="size-3.5" strokeWidth={2} />
            </span>
            {e.title} again
          </button>
        );
      })}
    </div>
  );
}

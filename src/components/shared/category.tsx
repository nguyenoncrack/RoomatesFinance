import { Ellipsis, House, Package, ShoppingCart, UtensilsCrossed, Wifi, Zap, type LucideIcon } from "lucide-react";
import { CATEGORY_LABELS, type Category } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

export const CATEGORY_META: Record<Category, { icon: LucideIcon; tone: string; chart: string }> = {
  groceries: { icon: ShoppingCart, tone: "bg-emerald-50 text-emerald-700 ring-emerald-100", chart: "var(--chart-2)" },
  utilities: { icon: Zap, tone: "bg-amber-50 text-amber-700 ring-amber-100", chart: "var(--chart-3)" },
  rent: { icon: House, tone: "bg-indigo-50 text-indigo-700 ring-indigo-100", chart: "var(--chart-1)" },
  internet: { icon: Wifi, tone: "bg-sky-50 text-sky-700 ring-sky-100", chart: "var(--chart-6)" },
  household_supplies: { icon: Package, tone: "bg-violet-50 text-violet-700 ring-violet-100", chart: "var(--chart-5)" },
  food: { icon: UtensilsCrossed, tone: "bg-rose-50 text-rose-700 ring-rose-100", chart: "var(--chart-4)" },
  other: { icon: Ellipsis, tone: "bg-slate-100 text-slate-600 ring-slate-200", chart: "var(--chart-7)" },
};

export function CategoryIcon({ category, className }: { category: Category; className?: string }) {
  const { icon: Icon, tone } = CATEGORY_META[category];
  return (
    <span className={cn("inline-flex size-9 shrink-0 items-center justify-center rounded-xl ring-1", tone, className)} aria-label={CATEGORY_LABELS[category]}>
      <Icon className="size-4" />
    </span>
  );
}

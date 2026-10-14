import { Ellipsis, House, Package, ShoppingCart, UtensilsCrossed, Wifi, Zap, type LucideIcon } from "lucide-react";
import { CATEGORY_LABELS, type Category } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

export const CATEGORY_META: Record<Category, { icon: LucideIcon; tone: string; chart: string }> = {
  groceries: { icon: ShoppingCart, tone: "bg-emerald-400/10 text-emerald-700 ring-emerald-400/20", chart: "var(--chart-2)" },
  utilities: { icon: Zap, tone: "bg-amber-400/10 text-amber-700 ring-amber-400/20", chart: "var(--chart-3)" },
  rent: { icon: House, tone: "bg-teal-400/10 text-teal-700 ring-teal-400/20", chart: "var(--chart-1)" },
  internet: { icon: Wifi, tone: "bg-sky-400/10 text-sky-700 ring-sky-400/20", chart: "var(--chart-6)" },
  household_supplies: { icon: Package, tone: "bg-lime-400/10 text-lime-700 ring-lime-400/20", chart: "var(--chart-5)" },
  food: { icon: UtensilsCrossed, tone: "bg-rose-400/10 text-rose-700 ring-rose-400/20", chart: "var(--chart-4)" },
  other: { icon: Ellipsis, tone: "bg-foreground/5 text-zinc-600 ring-foreground/10", chart: "var(--chart-7)" },
};

export function CategoryIcon({ category, className }: { category: Category; className?: string }) {
  const { icon: Icon, tone } = CATEGORY_META[category];
  return (
    <span className={cn("inline-flex size-9 shrink-0 items-center justify-center rounded-xl ring-1", tone, className)} aria-label={CATEGORY_LABELS[category]}>
      <Icon className="size-4" />
    </span>
  );
}

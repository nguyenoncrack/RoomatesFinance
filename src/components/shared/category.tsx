import { Ellipsis, House, Package, ShoppingCart, UtensilsCrossed, Wifi, Zap, type LucideIcon } from "lucide-react";
import { CATEGORY_LABELS, type Category } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

export const CATEGORY_META: Record<Category, { icon: LucideIcon; tone: string; chart: string }> = {
  groceries: { icon: ShoppingCart, tone: "bg-pop-green", chart: "var(--pop-green)" },
  utilities: { icon: Zap, tone: "bg-pop-yellow", chart: "var(--pop-yellow)" },
  rent: { icon: House, tone: "bg-pop-pink", chart: "var(--pop-pink)" },
  internet: { icon: Wifi, tone: "bg-pop-blue", chart: "var(--pop-blue)" },
  household_supplies: { icon: Package, tone: "bg-pop-purple", chart: "var(--pop-purple)" },
  food: { icon: UtensilsCrossed, tone: "bg-pop-orange", chart: "var(--pop-orange)" },
  other: { icon: Ellipsis, tone: "bg-lilac", chart: "var(--chart-7)" },
};

export function CategoryIcon({ category, className }: { category: Category; className?: string }) {
  const { icon: Icon, tone } = CATEGORY_META[category];
  return (
    <span
      className={cn("inline-flex size-10 shrink-0 items-center justify-center rounded-full text-foreground sticker-sm", tone, className)}
      aria-label={CATEGORY_LABELS[category]}
    >
      <Icon className="size-[18px]" strokeWidth={2} />
    </span>
  );
}

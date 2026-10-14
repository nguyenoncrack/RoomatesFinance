import { formatCents } from "@/lib/domain/money";
import { AnimatedMoney } from "./animated-money";
import { cn } from "@/lib/utils";

/** Colored amount: green = receives money, red = owes, gray = settled. */
export function BalanceAmount({
  cents,
  className,
  signed = true,
  absolute = false,
  animated = false,
}: {
  cents: number;
  className?: string;
  signed?: boolean;
  /** Show the magnitude only, keeping the sign as color. */
  absolute?: boolean;
  /** Count/tick to new values with a green or red flash. */
  animated?: boolean;
}) {
  return (
    <span
      className={cn(
        "font-semibold tabular-nums",
        cents > 0 ? "text-positive" : cents < 0 ? "text-negative" : "text-muted-foreground",
        className,
      )}
    >
      {animated ? (
        <AnimatedMoney cents={cents} signed={signed} absolute={absolute} />
      ) : absolute ? (
        formatCents(Math.abs(cents))
      ) : (
        formatCents(cents, { signed })
      )}
    </span>
  );
}

export function balanceLabel(cents: number) {
  if (cents > 0) return `gets back ${formatCents(cents)}`;
  if (cents < 0) return `owes ${formatCents(-cents)}`;
  return "settled up";
}

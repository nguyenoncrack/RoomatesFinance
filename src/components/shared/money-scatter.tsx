import type { CSSProperties } from "react";
import { BillDoodle, CardDoodle, DollarCoinDoodle, MoneyBagDoodle, PiggyDoodle, SparkleDoodle } from "@/components/shared/doodles";
import { cn } from "@/lib/utils";

type Piece = {
  Doodle: typeof BillDoodle;
  className: string;
  rotate: number;
  delay: number;
  color?: string;
};

/** Hand-placed so pieces sit in the page gutters and peek out between cards. */
const PIECES: Piece[] = [
  { Doodle: BillDoodle, className: "top-[16%] left-[1.5%] h-16 w-28", rotate: -16, delay: 0 },
  { Doodle: DollarCoinDoodle, className: "top-[46%] left-[0.5%] size-14", rotate: 12, delay: 0.9 },
  { Doodle: CardDoodle, className: "bottom-[10%] left-[2%] h-12 w-20", rotate: -8, delay: 1.6 },
  { Doodle: BillDoodle, className: "top-[30%] right-[1%] h-14 w-24", rotate: 20, delay: 0.4 },
  { Doodle: MoneyBagDoodle, className: "top-[62%] right-[1.5%] size-16", rotate: -6, delay: 1.2 },
  { Doodle: PiggyDoodle, className: "bottom-[4%] right-[5%] h-16 w-20", rotate: 4, delay: 2 },
  { Doodle: DollarCoinDoodle, className: "top-[12%] right-[6%] size-9", rotate: -18, delay: 2.4 },
];

const SPARKS = [
  { className: "top-[26%] left-[6%] size-4", color: "var(--pop-pink)", delay: 0.3 },
  { className: "top-[72%] left-[5%] size-5", color: "var(--pop-yellow)", delay: 1.1 },
  { className: "top-[50%] right-[6%] size-4", color: "var(--pop-blue)", delay: 0.7 },
];

/**
 * Floating money doodles behind the page content. Purely decorative and only on wide screens,
 * where the gutters beside the content column have room for them.
 */
export function MoneyScatter({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("pointer-events-none fixed inset-y-0 right-0 left-64 z-0 hidden overflow-hidden xl:block", className)}>
      {PIECES.map(({ Doodle, className: pos, rotate, delay }, i) => (
        <span
          key={i}
          className={cn("absolute animate-bob", pos)}
          style={{ animationDelay: `${delay}s`, animationDuration: `${3.6 + (i % 3) * 0.7}s` } as CSSProperties}
        >
          <span className="block size-full" style={{ transform: `rotate(${rotate}deg)` }}>
            <Doodle className="size-full drop-shadow-[2px_2px_0_var(--foreground)]" />
          </span>
        </span>
      ))}
      {SPARKS.map((sp, i) => (
        <span key={i} className={cn("absolute animate-wiggle [--wiggle-amount:22deg]", sp.className)} style={{ animationDelay: `${sp.delay}s` }}>
          <SparkleDoodle className="size-full" color={sp.color} />
        </span>
      ))}
    </div>
  );
}

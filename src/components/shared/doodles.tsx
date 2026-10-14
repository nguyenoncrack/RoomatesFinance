import type { ReactNode, SVGProps } from "react";
import { cn } from "@/lib/utils";

/**
 * Hand-drawn cartoon doodles: thick ink outlines over flat pop-color fills, a little wobbly on purpose.
 * All strokes use currentColor (ink), so they follow the text color of wherever they sit.
 */

const INK = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2.4,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const satisfies SVGProps<SVGPathElement>;

function Frame({ children, className, label }: { children: ReactNode; className?: string; label?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn("size-14 overflow-visible text-foreground", className)} aria-hidden={label ? undefined : true} role={label ? "img" : undefined} aria-label={label}>
      {children}
    </svg>
  );
}

export function CoinsDoodle({ className }: { className?: string }) {
  return (
    <Frame className={className}>
      <ellipse {...INK} cx="24" cy="48" rx="15" ry="5.5" fill="var(--pop-yellow)" />
      <path {...INK} d="M9 48v-5c0 3 6.7 5.5 15 5.5S39 46 39 43v5" fill="var(--pop-yellow)" />
      <ellipse {...INK} cx="24" cy="40" rx="15" ry="5.5" fill="var(--pop-yellow)" />
      <path {...INK} d="M9 40v-5c0 3 6.7 5.5 15 5.5S39 38 39 35v5" fill="var(--pop-yellow)" />
      <ellipse {...INK} cx="24" cy="32" rx="15" ry="5.5" fill="var(--pop-yellow)" />
      <circle {...INK} cx="45" cy="25" r="13" fill="var(--pop-orange)" />
      <path {...INK} d="M48.5 20.5c-1-1.6-3-2.4-4.8-2-2 .4-3 2-2.4 3.6.6 1.8 3 2 4.6 2.6 1.8.6 2.8 2.2 2 3.8-.8 1.8-3.6 2.4-5.6 1.2M45 16v2M45 32v2" strokeWidth={2} />
      <path {...INK} d="M56 9l1.5 3.5L61 14l-3.5 1.5L56 19l-1.5-3.5L51 14l3.5-1.5z" fill="var(--pop-pink)" strokeWidth={1.8} />
    </Frame>
  );
}

export function HouseDoodle({ className }: { className?: string }) {
  return (
    <Frame className={className}>
      <path {...INK} d="M45 18v-8h6v13" fill="var(--pop-orange)" />
      <path {...INK} d="M48 6c-2-2 1-4-1-6" strokeWidth={1.8} />
      <path {...INK} d="M10 30L32 11l22 19" fill="var(--pop-pink)" />
      <path {...INK} d="M15 27v27h34V27" fill="var(--butter)" />
      <path {...INK} d="M27 54V40c0-2 1.5-3 5-3s5 1 5 3v14" fill="var(--pop-blue)" />
      <rect {...INK} x="19" y="30" width="7" height="7" rx="1.5" fill="var(--sky)" strokeWidth={2} />
      <rect {...INK} x="38" y="30" width="7" height="7" rx="1.5" fill="var(--sky)" strokeWidth={2} />
      <path {...INK} d="M6 54h52" />
    </Frame>
  );
}

export function ReceiptDoodle({ className }: { className?: string }) {
  return (
    <Frame className={className}>
      <path {...INK} d="M15 6h34v50l-4-3-4 3-4-3-4 3-4-3-4 3-4-3-6 3z" fill="var(--paper, white)" transform="rotate(-6 32 32)" />
      <g transform="rotate(-6 32 32)">
        <path {...INK} d="M21 16h22M21 23h16M21 30h19" strokeWidth={2} />
        <path {...INK} d="M21 41h10" strokeWidth={2} />
        <rect {...INK} x="34" y="37" width="10" height="8" rx="2" fill="var(--pop-green)" strokeWidth={2} />
      </g>
      <circle {...INK} cx="52" cy="12" r="5" fill="var(--pop-pink)" strokeWidth={2} />
    </Frame>
  );
}

export function ArrowsDoodle({ className }: { className?: string }) {
  return (
    <Frame className={className}>
      <path {...INK} d="M10 26c4-12 18-17 30-12" />
      <path {...INK} d="M36 8l6 6-7 4" />
      <path {...INK} d="M54 38c-4 12-18 17-30 12" />
      <path {...INK} d="M28 56l-6-6 7-4" />
      <circle {...INK} cx="20" cy="40" r="9" fill="var(--pop-pink)" />
      <circle {...INK} cx="44" cy="25" r="9" fill="var(--pop-green)" />
      <path {...INK} d="M17.5 40h5M44 22.5v5M41.5 25h5" strokeWidth={2} />
    </Frame>
  );
}

export function ScaleDoodle({ className }: { className?: string }) {
  return (
    <Frame className={className}>
      <path {...INK} d="M32 10v42M20 56h24" />
      <path {...INK} d="M12 18h40" />
      <circle {...INK} cx="32" cy="9" r="3.5" fill="var(--pop-yellow)" strokeWidth={2} />
      <path {...INK} d="M12 18L5 36h14z" strokeWidth={2} />
      <path {...INK} d="M52 18l-7 18h14z" strokeWidth={2} />
      <path {...INK} d="M4 36c0 5 4 7 8 7s8-2 8-7z" fill="var(--pop-green)" />
      <path {...INK} d="M44 36c0 5 4 7 8 7s8-2 8-7z" fill="var(--pop-pink)" />
    </Frame>
  );
}

export function PieDoodle({ className }: { className?: string }) {
  return (
    <Frame className={className}>
      <path {...INK} d="M28 12a22 22 0 1 0 22 22H28z" fill="var(--pop-blue)" />
      <path {...INK} d="M34 6a22 22 0 0 1 22 22H34z" fill="var(--pop-pink)" />
      <path {...INK} d="M14 46c4 4 10 6 14 6" strokeWidth={1.8} opacity={0.5} />
    </Frame>
  );
}

export function ChartDoodle({ className }: { className?: string }) {
  return (
    <Frame className={className}>
      <path {...INK} d="M8 56h50" />
      <rect {...INK} x="12" y="38" width="9" height="18" rx="2" fill="var(--pop-yellow)" />
      <rect {...INK} x="27" y="28" width="9" height="28" rx="2" fill="var(--pop-green)" />
      <rect {...INK} x="42" y="18" width="9" height="38" rx="2" fill="var(--pop-pink)" />
      <path {...INK} d="M10 26c8-2 14-8 20-14 4 4 8 4 14-4" strokeWidth={2} />
      <path {...INK} d="M40 6l5 1-1 5" strokeWidth={2} />
    </Frame>
  );
}

export function PeopleDoodle({ className }: { className?: string }) {
  return (
    <Frame className={className}>
      <path {...INK} d="M30 56c0-10 6-16 14-16s14 6 14 16z" fill="var(--pop-green)" />
      <circle {...INK} cx="44" cy="28" r="9" fill="var(--butter)" />
      <path {...INK} d="M6 56c0-11 6-18 15-18s15 7 15 18z" fill="var(--pop-pink)" />
      <circle {...INK} cx="21" cy="25" r="10" fill="var(--butter)" />
      <path {...INK} d="M17.5 24.5h.01M24.5 24.5h.01M41 27.5h.01M47 27.5h.01" strokeWidth={3.4} />
      <path {...INK} d="M18 29c2 2 5 2 7 0M41.5 32c1.5 1.4 3.5 1.4 5 0" strokeWidth={1.8} />
    </Frame>
  );
}

export function ClockDoodle({ className }: { className?: string }) {
  return (
    <Frame className={className}>
      <circle {...INK} cx="32" cy="34" r="22" fill="var(--sky)" />
      <path {...INK} d="M32 21v13l9 6" />
      <path {...INK} d="M14 12l-6 6M50 12l6 6" />
      <circle cx="32" cy="34" r="2.5" fill="currentColor" />
    </Frame>
  );
}

export function PlantDoodle({ className }: { className?: string }) {
  return (
    <Frame className={className}>
      <path {...INK} d="M32 40V20" />
      <path {...INK} d="M32 30c-10 0-16-6-16-14 9 0 16 5 16 14z" fill="var(--pop-green)" />
      <path {...INK} d="M32 24c0-9 6-15 16-15 0 9-6 15-16 15z" fill="var(--pop-green)" />
      <path {...INK} d="M18 40h28l-4 18H22z" fill="var(--pop-orange)" />
      <path {...INK} d="M16 40h32" />
    </Frame>
  );
}

export function SparkleDoodle({ className, color = "var(--pop-yellow)" }: { className?: string; color?: string }) {
  return (
    <Frame className={className}>
      <path {...INK} d="M32 6c2 14 6 20 22 26-16 6-20 12-22 26-2-14-6-20-22-26 16-6 20-12 22-26z" fill={color} />
    </Frame>
  );
}

export function SquiggleDoodle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 16" className={cn("h-3 w-24 text-foreground", className)} aria-hidden>
      <path {...INK} d="M2 10c8-8 14 6 22-2s14 6 22-2 14 6 22-2 14 6 22-2 14 6 26-2" strokeWidth={2.2} />
    </svg>
  );
}

export const DOODLES = {
  coins: CoinsDoodle,
  house: HouseDoodle,
  receipt: ReceiptDoodle,
  arrows: ArrowsDoodle,
  scale: ScaleDoodle,
  pie: PieDoodle,
  chart: ChartDoodle,
  people: PeopleDoodle,
  clock: ClockDoodle,
  plant: PlantDoodle,
  sparkle: SparkleDoodle,
} as const;

export type DoodleName = keyof typeof DOODLES;

/**
 * "Penny", the household's coin mascot: a round gold coin in a backwards cap, waving with one hand
 * and holding a receipt in the other. Mood changes the face.
 */
export function Mascot({ mood = "happy", className }: { mood?: "happy" | "worried" | "proud"; className?: string }) {
  return (
    <svg viewBox="0 0 170 180" className={cn("h-40 w-auto overflow-visible text-foreground", className)} role="img" aria-label="Penny the coin mascot">
      {/* shadow */}
      <ellipse cx="86" cy="172" rx="40" ry="5" fill="currentColor" opacity={0.12} />
      {/* legs + sneakers */}
      <path {...INK} d="M70 128l-6 30M100 128l6 30" strokeWidth={4} />
      <path {...INK} d="M48 160c0-6 6-9 15-9 7 0 11 3 11 8v3H50c-1.4 0-2-.8-2-2z" fill="var(--pop-pink)" strokeWidth={3} />
      <path {...INK} d="M96 159c0-5 4-8 11-8 9 0 15 3 15 9 0 1.2-.6 2-2 2H98c-1.2 0-2-.8-2-2z" fill="var(--pop-pink)" strokeWidth={3} />
      <path {...INK} d="M54 156h8M104 156h8" strokeWidth={2} />
      {/* waving arm */}
      <g className="animate-wiggle [--wiggle-amount:-14deg] [--wiggle-duration:1.6s]" style={{ transformOrigin: "40px 92px", transformBox: "view-box" }}>
        <path {...INK} d="M42 92C30 84 24 70 22 56" strokeWidth={4} />
        <path {...INK} d="M14 50c0-6 4-10 9-10s8 4 8 8c0 3-1 5-2 7l3 2c1 1 0 3-1 3-4 1-8 1-11-1-4-2-6-5-6-9z" fill="white" strokeWidth={3} />
        <path {...INK} d="M18 44l-2-5M23 41l-1-5M28 43l1-4" strokeWidth={2} />
      </g>
      {/* holding arm + receipt */}
      <path {...INK} d="M128 96c10 4 16 10 18 18" strokeWidth={4} />
      <g transform="rotate(14 148 108)">
        <path {...INK} d="M138 92h22v28l-3-2-3 2-3-2-3 2-3-2-3 2-4-2z" fill="var(--sky)" strokeWidth={2.6} />
        <path {...INK} d="M143 100h12M143 106h8" strokeWidth={2} />
      </g>
      <circle {...INK} cx="145" cy="116" r="7" fill="white" strokeWidth={3} />
      {/* coin body */}
      <circle {...INK} cx="85" cy="88" r="48" fill="var(--pop-yellow)" strokeWidth={3.5} />
      <circle {...INK} cx="85" cy="88" r="39" strokeWidth={2} strokeDasharray="3 6" opacity={0.6} />
      <path d="M50 70c4-12 14-20 26-22" stroke="white" strokeWidth={5} strokeLinecap="round" fill="none" opacity={0.7} />
      {/* backwards cap */}
      <path {...INK} d="M44 66c0-22 18-36 41-36s41 14 41 36c-12-6-26-9-41-9s-29 3-41 9z" fill="var(--pop-blue)" strokeWidth={3.5} />
      <path {...INK} d="M44 66c-10 0-16-3-20-8 8-4 14-5 22-4" fill="var(--pop-blue)" strokeWidth={3} />
      <circle {...INK} cx="85" cy="30" r="4" fill="var(--pop-pink)" strokeWidth={2.5} />
      <path {...INK} d="M68 48c2-6 7-10 12-11" strokeWidth={2} opacity={0.5} />
      {/* face */}
      {mood === "worried" ? (
        <>
          <path {...INK} d="M61 82l11-4M109 82l-11-4" strokeWidth={3} />
          <ellipse cx="70" cy="89" rx="4.5" ry="6" fill="currentColor" />
          <ellipse cx="100" cy="89" rx="4.5" ry="6" fill="currentColor" />
          <path {...INK} d="M74 112c6-5 16-5 22 0" strokeWidth={3} />
          <path {...INK} d="M118 74c3 4 3 8 0 10-3-2-3-6 0-10z" fill="var(--sky)" strokeWidth={2} />
        </>
      ) : (
        <>
          {mood === "proud" ? (
            <path {...INK} d="M63 88c3-4 9-4 12 0M95 88c3-4 9-4 12 0" strokeWidth={3.2} />
          ) : (
            <>
              <ellipse cx="70" cy="88" rx="5" ry="7" fill="currentColor" />
              <ellipse cx="100" cy="88" rx="5" ry="7" fill="currentColor" />
              <circle cx="72" cy="85" r="1.8" fill="white" />
              <circle cx="102" cy="85" r="1.8" fill="white" />
            </>
          )}
          <path {...INK} d="M68 104c8 10 26 10 34 0" fill="white" strokeWidth={3} />
          <path {...INK} d="M68 104c8 3 26 3 34 0" strokeWidth={2} />
        </>
      )}
      <ellipse cx="58" cy="100" rx="6" ry="4" fill="var(--pop-pink)" opacity={0.75} />
      <ellipse cx="112" cy="100" rx="6" ry="4" fill="var(--pop-pink)" opacity={0.75} />
    </svg>
  );
}

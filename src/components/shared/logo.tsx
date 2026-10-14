import Link from "next/link";
import { SquiggleDoodle } from "@/components/shared/doodles";

/** Hand-drawn mark: a little yellow house whose door is a "$". */
function LogoMark() {
  return (
    <svg viewBox="0 0 40 40" className="size-10 overflow-visible text-foreground" aria-hidden>
      <path d="M30 13V6h4v10" fill="var(--pop-orange)" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" />
      <path d="M5 19L20 6l15 13" fill="var(--pop-pink)" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8.5 17v18h23V17" fill="var(--pop-yellow)" stroke="currentColor" strokeWidth={2.2} strokeLinejoin="round" />
      <path d="M16 35V26c0-1.5 1.2-2.5 4-2.5s4 1 4 2.5v9" fill="var(--money-light)" stroke="currentColor" strokeWidth={2} />
      <path
        d="M21.6 27.4c-.4-.7-1.2-1-1.9-.9-.9.1-1.5.7-1.3 1.4.2.8 1.2 1 2 1.2.8.3 1.3.9 1 1.6-.3.8-1.4 1.1-2.3.7M20 25.4v.9M20 32v.9"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.2}
        strokeLinecap="round"
      />
      <path d="M2 35h36" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ href = "/dashboard" }: { href?: string }) {
  return (
    <Link href={href} className="group flex items-center gap-2" aria-label="Roommate Finance">
      <span className="origin-bottom transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-105 motion-reduce:transition-none">
        <LogoMark />
      </span>
      <span className="flex flex-col leading-none">
        <span className="font-display text-[22px] leading-none">Roommate</span>
        <span className="relative -mt-0.5 ml-1 w-fit -rotate-3 font-hand text-[17px] leading-tight text-primary">
          finance
          <SquiggleDoodle className="absolute -bottom-1 left-0 h-1.5 w-full text-primary/70" />
        </span>
      </span>
    </Link>
  );
}

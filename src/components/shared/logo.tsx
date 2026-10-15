import Link from "next/link";

/** A gold coin caught in a crab-claw pincer: a penny, pinched. */
function LogoMark() {
  return (
    <svg viewBox="0 0 56 46" className="logo-mark h-10 w-[49px] overflow-visible text-foreground" aria-hidden>
      <g className="logo-coin" style={{ transformOrigin: "20px 20px", transformBox: "view-box" }}>
        <circle cx="21" cy="21" r="15" fill="#201e1a" transform="translate(1.500 2)" />
        <circle cx="20" cy="20" r="15" fill="var(--pop-yellow)" stroke="#201e1a" strokeWidth={2.400} />
        <circle cx="20" cy="20" r="10.500" fill="none" stroke="#201e1a" strokeWidth={1.400} strokeDasharray="2.600 2" opacity={0.55} />
        <path
          d="M22.600 15.600c-.6-1.300-2-1.800-3.200-1.600-1.500.3-2.200 1.500-1.700 2.700.5 1.100 1.800 1.400 3 1.800 1.300.4 2 1.100 1.600 2.300-.4 1.200-2 1.700-3.400 1.100M20.200 12.400v1.600M20.200 23.400v1.800"
          fill="none"
          stroke="#201e1a"
          strokeWidth={1.800}
          strokeLinecap="round"
        />
        <path d="M9 12c2-3 5-4.500 8-4.800" stroke="#fff" strokeWidth={2} strokeLinecap="round" fill="none" opacity={0.7} />
      </g>
      {/* claw: an arm and two pincers closing on the coin */}
      <g className="logo-claw" style={{ transformOrigin: "46px 34px", transformBox: "view-box" }} fill="none" strokeLinecap="round" strokeLinejoin="round">
        {[
          ["#201e1a", 10],
          ["oklch(0.7 0.13 150)", 6],
        ].map(([c, w]) => (
          <g key={String(c)} stroke={c as string} strokeWidth={w as number}>
            <path d="M47 34L53 41" />
            <path d="M47 34C46 24 42 16 34 11" />
            <path d="M47 34C42 37 37 35 34 30" />
          </g>
        ))}
        <path d="M45 28C44 23 41 19 38 16" stroke="#fff" strokeWidth={1.800} opacity={0.55} />
      </g>
      <path d="M50 5l1 3 3 1-3 1-1 3-1-3-3-1 3-1z" fill="var(--pop-yellow)" stroke="#201e1a" strokeWidth={1.200} strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ href = "/dashboard" }: { href?: string }) {
  return (
    <Link href={href} className="group flex items-center gap-1" aria-label="PennyPincher">
      <span className="origin-bottom transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-105 motion-reduce:transition-none">
        <LogoMark />
      </span>
      <span className="logo-text font-logo flex -rotate-2 items-baseline text-[19px] leading-none whitespace-nowrap">
        <span className="logo-word logo-penny">Penny</span>
        <span className="logo-word logo-ther">Pincher</span>
      </span>
    </Link>
  );
}

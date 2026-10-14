"use client";

import { useEffect, useRef } from "react";
import { startBuddy } from "@/lib/buddy-engine";
import { useBuddyEnabled } from "@/lib/buddy-pref";

const INK = "#201e1a";
const YELLOW = "#f7d94c";
const DENIM = "#3e6fb6";

/**
 * The little helper: a yellow, goggled, overall-wearing buddy drawn as inline SVG. All of his motion comes
 * from CSS keyed off `data-pose` / `data-facing` on the wrapper (see `.buddy` in globals.css).
 */
export function BuddySprite() {
  return (
    <svg viewBox="0 0 44 60" width="44" height="60" overflow="visible" aria-hidden>
      {/* hair */}
      <path d="M18 4.500C17 1.500 15.500 0.500 14 -0.500M22 3.500C22.200 0.500 22 -1 22 -2.500M26 4.500C27 1.500 28.500 0.500 30 -0.500" stroke={INK} strokeWidth={1.600} strokeLinecap="round" fill="none" />

      {/* legs */}
      <g className="buddy-leg buddy-leg-l">
        <rect x="13" y="42" width="6" height="10" fill={DENIM} stroke={INK} strokeWidth={1.400} />
        <path d="M11.500 52h9a2 2 0 0 1 2 2v3h-13v-3a2 2 0 0 1 2-2z" fill={INK} />
      </g>
      <g className="buddy-leg buddy-leg-r">
        <rect x="25" y="42" width="6" height="10" fill={DENIM} stroke={INK} strokeWidth={1.400} />
        <path d="M23.500 52h9a2 2 0 0 1 2 2v3h-13v-3a2 2 0 0 1 2-2z" fill={INK} />
      </g>

      {/* arms (behind the body edge, so they swing out from the sides) */}
      <g className="buddy-arm buddy-arm-l">
        <rect x="3.500" y="28" width="5.500" height="12" rx="2.700" fill={YELLOW} stroke={INK} strokeWidth={1.600} />
        <circle cx="6.200" cy="41.500" r="3.100" fill={INK} />
      </g>
      <g className="buddy-arm buddy-arm-r">
        <rect x="35" y="28" width="5.500" height="12" rx="2.700" fill={YELLOW} stroke={INK} strokeWidth={1.600} />
        <circle cx="37.800" cy="41.500" r="3.100" fill={INK} />
        <g className="buddy-brush">
          <rect x="34" y="42" width="11" height="4.500" rx="1.600" fill="#f48fb1" stroke={INK} strokeWidth={1.200} />
          <path d="M35.500 46.500v2.200M38 46.500v2.200M40.500 46.500v2.200M43 46.500v2.200" stroke={INK} strokeWidth={1.100} strokeLinecap="round" />
        </g>
      </g>

      {/* body */}
      <rect x="8" y="4" width="28" height="42" rx="14" fill={YELLOW} stroke={INK} strokeWidth={2} />
      {/* overalls */}
      <path d="M8.100 31h27.800v3c0 7.500-6 12-13.900 12S8.100 41.500 8.100 34z" fill={DENIM} stroke={INK} strokeWidth={1.800} strokeLinejoin="round" />
      <path d="M13.500 31.500 16 23M30.500 31.500 28 23" stroke={DENIM} strokeWidth={3.200} strokeLinecap="round" />
      <rect x="18" y="35" width="8" height="5.500" rx="1.500" fill="#35609f" stroke={INK} strokeWidth={1.200} />

      {/* goggle band + eye */}
      <rect x="8.800" y="14.500" width="26.400" height="5" fill="#2b2b2b" />
      <circle cx="22" cy="17" r="8.400" fill="#c9d1d8" stroke={INK} strokeWidth={2} />
      <circle cx="22" cy="17" r="5.800" fill="#fff" stroke={INK} strokeWidth={1} />
      <g className="buddy-pupil">
        <circle cx="22" cy="17" r="2.700" fill="#5b3a1e" />
        <circle cx="23" cy="16" r="0.9" fill="#fff" />
      </g>
      <ellipse className="buddy-lid" cx="22" cy="17" rx="6.100" ry="6" fill={YELLOW} />

      {/* mouth */}
      <path className="buddy-mouth" d="M17.500 28q4.500 3.200 9 0" stroke={INK} strokeWidth={1.800} strokeLinecap="round" fill="none" />
      <path className="buddy-mouth-happy" d="M16.500 27q5.500 7.500 11 0z" fill="#7a2e2e" stroke={INK} strokeWidth={1.600} strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Overlay that hosts the roaming helper. It ignores the pointer completely, sits under dialogs and the
 * header, and only ever moves itself, so it can't block a click or shift any content.
 */
export function RoamingBuddy() {
  const enabled = useBuddyEnabled();
  return enabled ? <BuddyLayer /> : null;
}

function BuddyLayer() {
  const buddyRef = useRef<HTMLDivElement>(null);
  const sudsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const buddy = buddyRef.current;
    const suds = sudsRef.current;
    if (!buddy || !suds) return;
    const handle = startBuddy({ buddy, suds });
    return () => handle.stop();
  }, []);

  return (
    <div aria-hidden className="buddy-layer pointer-events-none fixed inset-0 z-[25] overflow-hidden">
      <div ref={sudsRef} className="buddy-suds" />
      <div ref={buddyRef} className="buddy" data-pose="sit" data-facing="right">
        <div className="buddy-flip">
          <div className="buddy-body">
            <BuddySprite />
          </div>
        </div>
        <i className="buddy-star buddy-star-1" />
        <i className="buddy-star buddy-star-2" />
        <i className="buddy-star buddy-star-3" />
      </div>
    </div>
  );
}

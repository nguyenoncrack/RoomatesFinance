"use client";

import { useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useAppData } from "@/components/providers/app-data-provider";
import { buildReceipt, type ReceiptData } from "@/lib/receipt";
import { cn } from "@/lib/utils";

const INK = "#201e1a";
const PRINT_MS = 3400;
const RETRACT_MS = 420;

type State = "idle" | "printing" | "done" | "retracting";

/** The cartoon receipt printer: thick outline, hard shadow, a face and a status light. Motion comes from CSS keyed off `data-state`. */
function PrinterArt({ onPull, disabled }: { onPull: () => void; disabled: boolean }) {
  return (
    <svg viewBox="0 0 280 124" className="printer-art relative z-10 mx-auto block w-full max-w-[300px] overflow-visible" aria-hidden>
      <ellipse cx="140" cy="118" rx="112" ry="5" fill={INK} opacity={0.14} />
      {/* feet */}
      <rect x="42" y="104" width="34" height="10" rx="4" fill={INK} />
      <rect x="204" y="104" width="34" height="10" rx="4" fill={INK} />

      {/* slot-machine lever bolted to the side */}
      <g
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label="Pull lever to print another receipt"
        aria-disabled={disabled}
        onClick={onPull}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onPull();
          }
        }}
        className={cn("outline-none focus-visible:[&_.lever-base]:stroke-[#e5484d]", disabled ? "cursor-default" : "cursor-pointer")}
      >
        <g className="printer-lever" style={{ transformOrigin: "266px 56px", transformBox: "view-box" }}>
          <path d="M266 56 L274 20" stroke={INK} strokeWidth={9} strokeLinecap="round" />
          <path d="M266 56 L274 20" stroke="#d9d4c7" strokeWidth={4} strokeLinecap="round" />
          <circle cx="275" cy="14" r="11" fill={INK} />
          <circle cx="275" cy="14" r="9" fill="#e5484d" stroke={INK} strokeWidth={2} />
          <circle cx="271.500" cy="10.500" r="2.500" fill="#fff" opacity={0.8} />
        </g>
        <rect className="lever-base" x="256" y="42" width="14" height="28" rx="6" fill="#e8bd2c" stroke={INK} strokeWidth={3} />
        <circle cx="266" cy="56" r="3" fill={INK} />
        <rect x="244" y="0" width="36" height="124" fill="transparent" />
      </g>

      <g className="printer-body">
        {/* hard shadow, then the body */}
        <rect x="16" y="30" width="252" height="80" rx="24" fill={INK} />
        <rect x="10" y="24" width="252" height="80" rx="24" fill="var(--pop-yellow)" stroke={INK} strokeWidth={3} />
        {/* top lid with the paper slot */}
        <rect x="24" y="12" width="224" height="26" rx="13" fill="#e8bd2c" stroke={INK} strokeWidth={3} />
        <rect x="44" y="21" width="184" height="8" rx="4" fill={INK} />
        <path d="M30 20c14-3 34-3 52-1" stroke="#fff" strokeWidth={3} strokeLinecap="round" fill="none" opacity={0.7} />

        {/* face */}
        <circle cx="108" cy="66" r="5.500" fill={INK} />
        <circle cx="164" cy="66" r="5.500" fill={INK} />
        <circle cx="109.800" cy="64.200" r="1.700" fill="#fff" />
        <circle cx="165.800" cy="64.200" r="1.700" fill="#fff" />
        <path className="printer-mouth" d="M126 78q10 9 20 0" stroke={INK} strokeWidth={3} strokeLinecap="round" fill="none" />
        <ellipse cx="90" cy="76" rx="8" ry="5" fill="var(--pop-pink)" opacity={0.75} />
        <ellipse cx="182" cy="76" rx="8" ry="5" fill="var(--pop-pink)" opacity={0.75} />

        {/* controls */}
        <circle cx="38" cy="58" r="6" fill="var(--pop-blue)" stroke={INK} strokeWidth={2} />
        <circle cx="58" cy="58" r="6" fill="var(--pop-pink)" stroke={INK} strokeWidth={2} />
        <g className="printer-gear" style={{ transformOrigin: "46px 86px", transformBox: "view-box" }}>
          <circle cx="46" cy="86" r="9" fill="#fff" stroke={INK} strokeWidth={2} />
          <path d="M46 78v16M38 86h16" stroke={INK} strokeWidth={2} strokeLinecap="round" />
        </g>
        {/* status light */}
        <circle cx="236" cy="58" r="10" fill="#fff" stroke={INK} strokeWidth={2.500} />
        <circle className="printer-light" cx="236" cy="58" r="6" fill="var(--pop-green)" stroke={INK} strokeWidth={1.500} />
        {/* vents */}
        <path d="M200 90h40M204 97h32" stroke={INK} strokeWidth={2.500} strokeLinecap="round" opacity={0.55} />
      </g>
    </svg>
  );
}

function Zigzag() {
  const teeth = 14;
  const w = 100 / teeth;
  const d = Array.from({ length: teeth }, (_, i) => `L${(i * w + w / 2).toFixed(2)} 0 L${((i + 1) * w).toFixed(2)} 7`).join(" ");
  return (
    <svg viewBox="0 0 100 7" preserveAspectRatio="none" className="block h-[7px] w-full overflow-visible" aria-hidden>
      <path d={`M0 7 ${d} V8 H0 Z`} fill="#fffdf6" stroke={INK} strokeWidth={1.400} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      <rect x="0" y="6.500" width="100" height="2" fill="#fffdf6" />
    </svg>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: "positive" | "negative" }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="truncate text-[9.5px] tracking-[0.06em] text-[#201e1a]/70 uppercase">{label}</dt>
      <dd className={cn("text-[11.5px] font-semibold tabular-nums", tone === "positive" && "text-positive", tone === "negative" && "text-negative")}>{value}</dd>
    </div>
  );
}

function Dashed() {
  return <div className="my-1 border-t border-dashed border-[#201e1a]/45" aria-hidden />;
}

/** The printed paper: the person's real figures, in receipt style. */
function ReceiptPaper({ data }: { data: ReceiptData }) {
  return (
    <div className="w-[206px] font-mono text-[#201e1a]" role="article" aria-label={`Receipt for ${data.firstName}`}>
      <Zigzag />
      <div className="border-x border-b border-[#201e1a] bg-[#fffdf6] px-3.5 pt-1.5 pb-2.5 shadow-[2px_3px_0_0_rgba(32,30,26,0.25)]">
        <div className="text-center">
          <p className="font-logo text-[15px] leading-none">PennyPincher</p>
          <p className="mt-1 truncate text-[8.5px] tracking-[0.16em] uppercase">★ {data.householdName} ★</p>
          <p className="mt-0.5 text-[8px] text-[#201e1a]/65">
            {data.dateLabel} · {data.timeLabel} · No.{data.receiptNo}
          </p>
        </div>
        <Dashed />
        <dl className="space-y-[3px]">
          {data.lines.map((l) => (
            <Row key={l.label} {...l} />
          ))}
        </dl>
        {data.transfers.length > 0 ? (
          <>
            <Dashed />
            <p className="text-[8.5px] tracking-[0.12em] text-[#201e1a]/65 uppercase">Who pays whom</p>
            <ul className="mt-0.5 space-y-[3px]">
              {data.transfers.map((t, i) => (
                <li key={i} className="flex items-baseline justify-between gap-2 text-[10.5px]">
                  <span className={cn("truncate", t.mine && "font-semibold")}>{t.text}</span>
                  <span className="tabular-nums">{t.amount}</span>
                </li>
              ))}
            </ul>
            {data.moreTransfers > 0 ? <p className="mt-0.5 text-[9px] text-[#201e1a]/60">+ {data.moreTransfers} more</p> : null}
          </>
        ) : null}
        <Dashed />
        <div className="flex items-baseline justify-between">
          <span className="text-[10px] font-bold tracking-[0.1em] uppercase">{data.netLabel}</span>
          <span
            className={cn(
              "text-[15px] leading-none font-bold tabular-nums",
              data.netCents > 0 && "text-positive",
              data.netCents < 0 && "text-negative",
            )}
          >
            {data.lines[0].value}
          </span>
        </div>
        <Dashed />
        <div className="flex h-6 items-stretch justify-center gap-px" aria-hidden>
          {data.bars.map((w, i) => (
            <span key={i} className="bg-[#201e1a]" style={{ width: w }} />
          ))}
        </div>
        <p className="mt-1 text-center font-hand text-[15px] leading-none">thanks, {data.firstName}!</p>
      </div>
    </div>
  );
}

/**
 * Cartoon receipt printer. A receipt built from the real ledger slides out of the slot on entry.
 * The side lever retracts the old one and prints a fresh one.
 */
export function ReceiptPrinter({ className }: { className?: string }) {
  const { snapshot, ledger, user } = useAppData();
  const reduce = useReducedMotion();
  const [state, setState] = useState<State>("idle");
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [run, setRun] = useState(0);
  const timers = useRef<number[]>([]);

  const ready = Boolean(snapshot && ledger && user);
  const printRef = useRef<() => void>(() => {});
  const auto = useRef(false);

  useEffect(() => {
    printRef.current = print;
  });

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((t) => window.clearTimeout(t));
  }, []);

  // Print one receipt automatically each time the dashboard is opened.
  useEffect(() => {
    if (!ready || auto.current) return;
    auto.current = true;
    const t = window.setTimeout(() => printRef.current(), 450);
    return () => {
      window.clearTimeout(t);
      auto.current = false;
    };
  }, [ready]);

  if (!snapshot || !ledger || !user) return null;
  const busy = state === "printing" || state === "retracting";

  function startPrint() {
    if (!snapshot || !ledger || !user) return;
    setReceipt(buildReceipt(snapshot, ledger, user));
    setRun((r) => r + 1);
    if (reduce) {
      setState("done");
      return;
    }
    setState("printing");
    timers.current.push(window.setTimeout(() => setState("done"), PRINT_MS));
  }

  function print() {
    if (busy) return;
    if (receipt && !reduce) {
      setState("retracting");
      timers.current.push(window.setTimeout(startPrint, RETRACT_MS));
    } else {
      startPrint();
    }
  }

  return (
    <div
      role="region"
      aria-label="Receipt printer"
      data-state={state}
      className={cn("receipt-printer relative flex h-full flex-col rounded-[28px] bg-sky p-5 sticker", className)}
    >
      <div className="relative min-h-[420px] flex-1 overflow-hidden">
        {receipt ? (
          <div className="absolute inset-x-0 bottom-0 flex justify-center">
            <div
              key={run}
              className={cn("receipt-sheet", state === "printing" && "receipt-print", state === "retracting" && "receipt-retract")}
            >
              <ReceiptPaper data={receipt} />
            </div>
          </div>
        ) : (
          <p className="absolute inset-x-0 bottom-3 text-center font-hand text-2xl leading-none text-foreground/65">ready when you are!</p>
        )}
      </div>

      <div className="relative -mt-3">
        <PrinterArt onPull={print} disabled={busy} />
      </div>

      <span className="sr-only" role="status" aria-live="polite">
        {state === "printing" ? "Printing your receipt" : state === "done" ? "Receipt printed" : ""}
      </span>
    </div>
  );
}

"use client";

import { Activity, ChevronsUpDown, LayoutDashboard, Link2, Plus, Receipt, Scale, Settings, UserPlus, type LucideIcon } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import { ActivityTicker } from "@/components/activity/activity-ticker";
import { useAppData } from "@/components/providers/app-data-provider";
import { useDialogs } from "@/components/providers/dialogs-provider";
import { CelebrationLayer, celebrate } from "@/components/shared/celebration";
import { Logo } from "@/components/shared/logo";
import { MemberAvatar } from "@/components/shared/member-avatar";
import { MoneyScatter } from "@/components/shared/money-scatter";
import { RoamingBuddy } from "@/components/shared/roaming-buddy";
import { MusicToggle } from "@/components/shared/music-toggle";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { BillDoodle, DOODLES, DollarCoinDoodle, Mascot, PiggyDoodle, SparkleDoodle, type DoodleName, PeopleDoodle, SquiggleDoodle } from "@/components/shared/doodles";
import { ScrambleText } from "@/components/shared/scramble-text";
import { BalanceAmount } from "@/components/shared/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { HouseholdSetupCard, NoHouseholdState } from "./household-setup";
import { PixelIntro } from "./pixel-intro";
import { ShellError, ShellLoading } from "./shell-states";

const NAV: { href: string; label: string; icon: LucideIcon; doodle: DoodleName }[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, doodle: "house" },
  { href: "/expenses", label: "Expenses", icon: Receipt, doodle: "receipt" },
  { href: "/balances", label: "Balances", icon: Scale, doodle: "scale" },
  { href: "/activity", label: "Activity", icon: Activity, doodle: "clock" },
  { href: "/settings", label: "Settings", icon: Settings, doodle: "gear" },
];

function HouseholdSwitcher({ className }: { className?: string }) {
  const { households, activeHouseholdId, setActiveHousehold } = useAppData();
  const { openHousehold, openInvite } = useDialogs();
  const active = households.find((h) => h.id === activeHouseholdId);
  return (
    <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className={cn(
              "group/hh flex w-full items-center gap-2.5 rounded-2xl bg-foreground/[0.04] px-3 py-2.5 text-left transition-colors sketch-line hover:bg-foreground/[0.08]",
              className,
            )}
          >
            <span aria-hidden className="shrink-0 transition-transform duration-300 group-hover/hh:-rotate-6">
              <PeopleDoodle className="size-8" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-hand text-xl leading-tight">{active?.name ?? (households.length ? "Choose household" : "No household")}</span>
              <span className="block font-label text-[9.5px] text-muted-foreground">
                {active ? `${active.memberCount} roommate${active.memberCount === 1 ? "" : "s"}` : households.length ? "" : "Create or join one"}
              </span>
            </span>
            <ChevronsUpDown className="size-4 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          {households.length ? (
            <>
              <DropdownMenuLabel>Your households</DropdownMenuLabel>
              {households.map((h) => (
                <DropdownMenuItem key={h.id} onSelect={() => setActiveHousehold(h.id)} className="justify-between">
                  <span className="truncate">{h.name}</span>
                  {h.id === activeHouseholdId ? <Badge variant="secondary">Current</Badge> : null}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
            </>
          ) : null}
          {active ? (
            <DropdownMenuItem onSelect={openInvite}>
              <UserPlus /> Invite roommates
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onSelect={() => openHousehold("create")}>
            <Plus /> New household
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => openHousehold("join")}>
            <Link2 /> Join with invite link
          </DropdownMenuItem>
        </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Page title: its nav doodle, the scrambled-in serif label, and a pencil underline that draws itself in. */
function PageTitle({ label, doodle }: { label: string; doodle?: DoodleName }) {
  const Doodle = doodle ? DOODLES[doodle] : null;
  return (
    <h1 className="hidden items-center gap-2.5 md:flex">
      {Doodle ? (
        <span aria-hidden className="animate-wiggle [--wiggle-amount:-8deg] [--wiggle-duration:3.2s]">
          <Doodle className="size-9" />
        </span>
      ) : null}
      <span className="relative font-display text-3xl leading-none">
        <ScrambleText text={label} duration={550} />
        <svg aria-hidden viewBox="0 0 120 10" preserveAspectRatio="none" className="absolute -bottom-2.5 left-0 h-2.5 w-full overflow-visible text-pop-pink">
          <path
            d="M2 6c14-4 26-4 40-1s30 3 44 0 22-3 32-1"
            pathLength={1}
            className="pencil-stroke animate-pencil [--pencil-delay:0.35s] [--pencil-duration:0.9s]"
            strokeWidth={3}
          />
        </svg>
      </span>
    </h1>
  );
}

/** Your name on a taped-on paper note, with a mini Penny peeking over it whose face follows your balance. */
/** Always-visible sidebar shortcut to the invite dialog. */
function InviteButton() {
  const { openInvite } = useDialogs();
  return (
    <button
      type="button"
      onClick={openInvite}
      className="group/invite -mt-2 flex w-full items-center gap-2.5 rounded-2xl px-3 py-1.5 text-left font-label text-[11px] text-muted-foreground transition-[color,translate] hover:translate-x-1 hover:text-foreground"
    >
      <span aria-hidden className="grid size-7 place-items-center transition-transform group-hover/invite:animate-wiggle group-hover/invite:[--wiggle-amount:12deg] group-hover/invite:[--wiggle-duration:0.6s]">
        <PeopleDoodle className="size-7" />
      </span>
      Invite roommates
      <Plus aria-hidden className="ml-auto size-3.5 opacity-60" strokeWidth={2} />
    </button>
  );
}

function MyBalancePill() {
  const { ledger, user } = useAppData();
  if (!ledger || !user) return null;
  const net = ledger.balances.get(user.id) ?? 0;
  return (
    <div className="theme-paper relative mx-1 animate-sway hover:[animation-play-state:paused]">
      <span aria-hidden className="absolute -top-14 right-1 z-10 animate-bob">
        <Mascot mood={net < 0 ? "worried" : net > 0 ? "proud" : "happy"} className="h-[4.25rem]" />
      </span>
      <div className="relative rounded-2xl bg-card px-3 pt-4 pb-3 sticker-sm">
        <span
          aria-hidden
          className="absolute -top-2.5 left-5 z-[3] h-5 w-14 -rotate-6 bg-butter/85 [clip-path:polygon(4%_0,96%_6%,100%_100%,0_94%)]"
        />
        <div className="flex items-center gap-3">
          <MemberAvatar id={user.id} name={user.displayName} src={user.avatarUrl} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-hand text-xl leading-tight">{user.displayName}</p>
            <p className="font-hand text-base leading-tight text-muted-foreground">
              {net > 0 ? "you're owed" : net < 0 ? "you owe" : "all settled ✓"}{" "}
              {net !== 0 ? <BalanceAmount cents={net} absolute animated className="font-hand text-lg font-normal" /> : null}
            </p>
          </div>
        </div>
        <SquiggleDoodle className="mt-2 h-2 w-full opacity-25" />
      </div>
    </div>
  );
}

/** A bill drifting past while a coin drops into the piggy bank on a loop. */
function PiggyScene() {
  return (
    <div aria-hidden className="relative h-24 w-44">
      <span className="absolute top-0 right-2 block h-10 w-16 animate-bob [animation-delay:0.6s]">
        <BillDoodle className="size-full rotate-12 drop-shadow-[2px_2px_0_oklch(0_0_0/60%)]" />
      </span>
      <span className="absolute top-[34px] left-[40px] block size-5 animate-coin-drop">
        <DollarCoinDoodle className="size-full" />
      </span>
      <span className="absolute bottom-0 left-3 block h-16 w-20 animate-piggy-jiggle">
        <PiggyDoodle coin={false} className="size-full drop-shadow-[2px_2px_0_oklch(0_0_0/60%)]" />
      </span>
      <span className="absolute bottom-12 left-0 size-3 animate-wiggle [--wiggle-amount:-30deg] [--wiggle-duration:1.4s]">
        <SparkleDoodle className="size-full" color="var(--pop-pink)" />
      </span>
    </div>
  );
}

const MOBILE_NAV = NAV.filter((n) => n.href !== "/settings");

function MobileTab({ href, label, icon: Icon, active }: { href: string; label: string; icon: LucideIcon; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex flex-col items-center gap-1 rounded-xl py-2 text-[10.5px] font-medium transition-colors",
        active ? "text-accent-foreground" : "text-muted-foreground active:text-foreground",
      )}
    >
      {active ? <motion.span layoutId="mobile-tab" className="absolute inset-x-2 inset-y-0.5 -z-10 rounded-xl bg-primary/10" transition={{ type: "spring", stiffness: 500, damping: 40 }} /> : null}
      <Icon className="size-5" strokeWidth={active ? 2.25 : 1.75} />
      {label === "Dashboard" ? "Home" : label}
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { status, error, reload, repo, setupSkipped } = useAppData();
  const { openAddExpense, openSettleUp, openHousehold } = useDialogs();
  const ready = status === "ready";
  const browsing = status === "no-households" && setupSkipped;
  const inApp = ready || browsing;
  const current = NAV.find((n) => pathname.startsWith(n.href));
  const rootRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={rootRef} className="flex min-h-dvh w-full">
      <PixelIntro ready={status !== "loading"} target={rootRef} />
      {/* Reserves the sidebar's width: the sidebar itself is fixed, so scrolling (or the elastic bounce past the end of the page) never moves it. */}
      <div aria-hidden className="hidden w-64 shrink-0 md:block" />
      <aside className="theme-night fixed inset-y-0 left-0 z-20 hidden w-64 flex-col overflow-y-auto overscroll-contain gap-5 border-r-[1.5px] border-[var(--night)] bg-night bg-[radial-gradient(30rem_20rem_at_0%_0%,oklch(1_0_0/5%),transparent_60%)] px-4 py-5 md:flex">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-[image:var(--texture-plaster)] bg-[length:260px_260px] opacity-[0.16] mix-blend-soft-light" />
        <span aria-hidden className="pointer-events-none absolute top-24 right-4 size-3 animate-wiggle [--wiggle-amount:25deg]">
          <SparkleDoodle className="size-full" color="var(--pop-yellow)" />
        </span>
        <div className="flex items-center justify-between">
          <Logo />
          {repo.mode === "demo" ? <DemoBadge /> : null}
        </div>
        {inApp ? <HouseholdSwitcher /> : null}
        {ready ? <InviteButton /> : null}
        <nav className="flex flex-col gap-0.5">
          {NAV.map(({ href, label, doodle }, i) => {
            const active = pathname.startsWith(href);
            const Doodle = DOODLES[doodle];
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group/nav relative isolate flex items-center gap-3 rounded-2xl px-3 py-2 font-label text-[11px] transition-[color,translate] duration-200",
                  active ? "text-foreground" : "text-muted-foreground hover:translate-x-1 hover:text-foreground",
                )}
              >
                {active ? (
                  <motion.span
                    layoutId="sidebar-active"
                    className="absolute inset-0 -z-10 rounded-2xl bg-foreground/[0.07] sketch-line"
                    transition={{ type: "spring", stiffness: 420, damping: 38 }}
                  />
                ) : null}
                <span
                  aria-hidden
                  className={cn(
                    "grid size-7 place-items-center transition-[opacity,filter] duration-200",
                    active ? "animate-wiggle [--wiggle-amount:-8deg] [--wiggle-duration:3s]" : "opacity-75 grayscale-[0.35] group-hover/nav:animate-wiggle group-hover/nav:opacity-100 group-hover/nav:grayscale-0 group-hover/nav:[--wiggle-amount:12deg] group-hover/nav:[--wiggle-duration:0.6s]",
                  )}
                >
                  <Doodle className="size-7" />
                </span>
                {label}
                <span aria-hidden className="ml-auto font-hand text-[15px] normal-case tracking-normal tabular-nums opacity-40">
                  {String(i + 1).padStart(2, "0")}
                </span>
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto space-y-2">
          <PiggyScene />
          {ready ? <MyBalancePill /> : null}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 bg-background/80 bg-[image:var(--pencil-divider)] bg-[length:60px_6px] bg-bottom bg-repeat-x backdrop-blur-xl">
          <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-2 px-4 md:h-16 md:px-8">
            <div className="min-w-0 md:hidden">
              {inApp ? <HouseholdSwitcher className="max-w-[48vw] bg-transparent px-0 after:hidden hover:bg-transparent" /> : <Logo />}
            </div>
            <PageTitle key={current?.href} label={current?.label ?? "Payther"} doodle={current?.doodle} />
            <div className="ml-auto flex items-center gap-2">
              {repo.mode === "demo" ? <DemoBadge className="md:hidden" /> : null}
              {ready ? <NotificationBell /> : null}
              {inApp ? <MusicToggle /> : null}
              {ready ? (
                <>
                  <Button variant="mint" size="sm" doodle="dollar" onClick={() => openSettleUp()} className="sm:hidden">
                    Settle
                  </Button>
                  <Button variant="mint" doodle="dollar" onClick={() => openSettleUp()} className="hidden sm:inline-flex">
                    Settle up
                  </Button>
                  <Button variant="pop" doodle="receipt" onClick={() => openAddExpense()} className="hidden sm:inline-flex">
                    Add expense
                  </Button>
                </>
              ) : null}
              {inApp ? (
                <Button variant="ghost" size="icon" asChild className="rounded-full md:hidden">
                  <Link href="/settings" aria-label="Settings">
                    <Settings />
                  </Link>
                </Button>
              ) : null}
            </div>
          </div>
          {ready ? <ActivityTicker className="border-b-0" /> : null}
        </header>

        {inApp ? <MoneyScatter /> : null}
        {ready ? <RoamingBuddy /> : null}
        <main className="relative z-[1] mx-auto w-full max-w-6xl flex-1 px-4 pt-5 pb-32 md:px-8 md:pt-8 md:pb-12">
          {status === "loading" ? <ShellLoading /> : null}
          {status === "error" ? <ShellError message={error} onRetry={reload} /> : null}
          {status === "no-households" && !setupSkipped ? <HouseholdSetupCard /> : null}
          {browsing ? pathname.startsWith("/settings") ? children : <NoHouseholdState pathname={pathname} /> : null}
          {ready ? (
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 8, filter: "blur(8px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            >
              {children}
            </motion.div>
          ) : null}
        </main>
      </div>

      <CelebrationLayer />
      {ready ? <SettledWatcher /> : null}
      {inApp ? (
        <nav
          aria-label="Primary"
          className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 rounded-2xl border border-foreground/10 bg-popover/85 shadow-2xl shadow-foreground/15 backdrop-blur-xl md:hidden"
        >
          <div className="grid grid-cols-5 items-center px-1.5 py-1">
            {MOBILE_NAV.slice(0, 2).map((n) => (
              <MobileTab key={n.href} {...n} active={pathname.startsWith(n.href)} />
            ))}
            <div className="flex justify-center">
              <motion.button
                type="button"
                whileTap={{ scale: 0.92 }}
                onClick={() => (ready ? openAddExpense() : openHousehold("create"))}
                aria-label={ready ? "Add Expense" : "Set up a household"}
                className="-mt-7 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground ring-4 ring-background"
              >
                <Plus className="size-6" strokeWidth={1.5} />
              </motion.button>
            </div>
            {MOBILE_NAV.slice(2).map((n) => (
              <MobileTab key={n.href} {...n} active={pathname.startsWith(n.href)} />
            ))}
          </div>
        </nav>
      ) : null}
    </div>
  );
}

/** Celebrates the moment the signed-in roommate's balance in the current household reaches exactly $0. */
function SettledWatcher() {
  const { ledger, user, activeHouseholdId } = useAppData();
  const net = ledger && user ? (ledger.balances.get(user.id) ?? 0) : null;
  const previous = useRef<{ householdId: string | null; net: number } | null>(null);

  useEffect(() => {
    if (net === null) return;
    const prev = previous.current;
    previous.current = { householdId: activeHouseholdId, net };
    if (prev && prev.householdId === activeHouseholdId && prev.net !== 0 && net === 0) {
      celebrate("All settled!", { subtitle: "You're square with everyone.", priority: 2 });
    }
  }, [net, activeHouseholdId]);

  return null;
}

function DemoBadge({ className }: { className?: string }) {
  return (
    <Badge variant="outline" className={cn("gap-1 rounded-full border-primary/40 bg-primary/15 text-[10px] text-foreground", className)}>
      <span className="size-1.5 rounded-full bg-primary" /> Demo
    </Badge>
  );
}

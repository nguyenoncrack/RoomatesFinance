"use client";

import { Activity, ChevronsUpDown, HandCoins, LayoutDashboard, Link2, Plus, Receipt, Scale, Settings, type LucideIcon } from "lucide-react";
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
import { ShellError, ShellLoading } from "./shell-states";

const NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/expenses", label: "Expenses", icon: Receipt },
  { href: "/balances", label: "Balances", icon: Scale },
  { href: "/activity", label: "Activity", icon: Activity },
  { href: "/settings", label: "Settings", icon: Settings },
];

function HouseholdSwitcher({ className }: { className?: string }) {
  const { households, activeHouseholdId, setActiveHousehold } = useAppData();
  const { openHousehold } = useDialogs();
  const active = households.find((h) => h.id === activeHouseholdId);
  return (
    <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className={cn(
              "flex w-full items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2 text-left transition-colors hover:border-primary/25 hover:bg-white/[0.05]",
              className,
            )}
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{active?.name ?? (households.length ? "Choose household" : "No household")}</span>
              <span className="block text-xs text-muted-foreground">
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

function MyBalancePill() {
  const { ledger, user } = useAppData();
  if (!ledger || !user) return null;
  const net = ledger.balances.get(user.id) ?? 0;
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-3">
      <div className="flex items-center gap-2">
        <MemberAvatar id={user.id} name={user.displayName} src={user.avatarUrl} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{user.displayName}</p>
          <p className="text-xs text-muted-foreground">
            {net > 0 ? "You're owed" : net < 0 ? "You owe" : "All settled"}{" "}
            {net !== 0 ? <BalanceAmount cents={net} absolute animated className="text-xs" /> : null}
          </p>
        </div>
      </div>
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

  return (
    <div className="flex min-h-dvh w-full bg-terminal">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-5 border-r border-sidebar-border bg-sidebar/80 px-4 py-5 backdrop-blur md:flex">
        <div className="flex items-center justify-between">
          <Logo />
          {repo.mode === "demo" ? <DemoBadge /> : null}
        </div>
        {inApp ? <HouseholdSwitcher /> : null}
        <nav className="flex flex-col gap-1">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                  "isolate",
                  active ? "text-sidebar-accent-foreground" : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground",
                )}
              >
                {active ? (
                  <motion.span layoutId="sidebar-active" className="absolute inset-0 -z-10 rounded-xl bg-sidebar-accent" transition={{ type: "spring", stiffness: 500, damping: 40 }}>
                    <span className="absolute top-2 bottom-2 -left-4 w-0.5 rounded-full bg-primary shadow-[0_0_12px_2px] shadow-primary/60" />
                  </motion.span>
                ) : null}
                <Icon className="size-4" />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto space-y-3">{ready ? <MyBalancePill /> : null}</div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-background/75 backdrop-blur-xl">
          <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-2 px-4 md:h-16 md:px-8">
            <div className="min-w-0 md:hidden">
              {inApp ? <HouseholdSwitcher className="max-w-[48vw] border-0 bg-transparent px-0 hover:bg-transparent" /> : <Logo />}
            </div>
            <h1 className="hidden font-display text-xl font-semibold tracking-tight md:block">{current?.label ?? "Roommate AI"}</h1>
            <div className="ml-auto flex items-center gap-2">
              {repo.mode === "demo" ? <DemoBadge className="md:hidden" /> : null}
              {ready ? (
                <>
                  <Button variant="outline" size="sm" onClick={() => openSettleUp()} className="h-8 rounded-full px-3 sm:hidden">
                    <HandCoins /> Settle
                  </Button>
                  <Button variant="outline" onClick={() => openSettleUp()} className="hidden h-9 rounded-full px-4 sm:inline-flex">
                    <HandCoins /> Settle up
                  </Button>
                  <Button onClick={() => openAddExpense()} className="hidden h-9 rounded-full px-4 font-semibold glow-primary glow-pulse sm:inline-flex">
                    <Plus strokeWidth={2.5} /> Add Expense
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

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-5 pb-32 md:px-8 md:pt-8 md:pb-12">
          {status === "loading" ? <ShellLoading /> : null}
          {status === "error" ? <ShellError message={error} onRetry={reload} /> : null}
          {status === "no-households" && !setupSkipped ? <HouseholdSetupCard /> : null}
          {browsing ? pathname.startsWith("/settings") ? children : <NoHouseholdState pathname={pathname} /> : null}
          {ready ? (
            <motion.div key={pathname} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}>
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
          className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 rounded-2xl border border-white/10 bg-popover/85 shadow-2xl shadow-black/60 backdrop-blur-xl md:hidden"
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
                className="-mt-7 flex size-14 items-center justify-center rounded-2xl bg-linear-to-br from-emerald-300 to-emerald-500 text-primary-foreground ring-4 ring-background glow-primary glow-pulse"
              >
                <Plus className="size-6" strokeWidth={2.75} />
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
    <Badge variant="outline" className={cn("gap-1 rounded-full border-primary/25 bg-primary/10 text-[10px] text-accent-foreground", className)}>
      <span className="size-1.5 rounded-full bg-primary" /> Demo
    </Badge>
  );
}

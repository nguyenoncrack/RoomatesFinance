"use client";

import { Activity, ChevronsUpDown, HandCoins, LayoutDashboard, Plus, Receipt, Scale, Settings, Sparkles, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useAppData } from "@/components/providers/app-data-provider";
import { useDialogs } from "@/components/providers/dialogs-provider";
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
import { CreateHouseholdDialog } from "./create-household-dialog";
import { ShellError, ShellLoading, NoHouseholds } from "./shell-states";

const NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/expenses", label: "Expenses", icon: Receipt },
  { href: "/balances", label: "Balances", icon: Scale },
  { href: "/activity", label: "Activity", icon: Activity },
  { href: "/settings", label: "Settings", icon: Settings },
];

function Logo() {
  return (
    <Link href="/dashboard" className="flex items-center gap-2 font-semibold tracking-tight">
      <span className="flex size-8 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
        <Sparkles className="size-4" />
      </span>
      <span>Roommate AI</span>
    </Link>
  );
}

function HouseholdSwitcher({ className }: { className?: string }) {
  const { households, activeHouseholdId, setActiveHousehold } = useAppData();
  const [createOpen, setCreateOpen] = useState(false);
  const active = households.find((h) => h.id === activeHouseholdId);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className={cn(
              "flex w-full items-center gap-2 rounded-xl border bg-card px-3 py-2 text-left shadow-xs transition-colors hover:bg-muted",
              className,
            )}
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{active?.name ?? "Choose household"}</span>
              <span className="block text-xs text-muted-foreground">
                {active ? `${active.memberCount} roommate${active.memberCount === 1 ? "" : "s"}` : ""}
              </span>
            </span>
            <ChevronsUpDown className="size-4 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel>Your households</DropdownMenuLabel>
          {households.map((h) => (
            <DropdownMenuItem key={h.id} onSelect={() => setActiveHousehold(h.id)} className="justify-between">
              <span className="truncate">{h.name}</span>
              {h.id === activeHouseholdId ? <Badge variant="secondary">Current</Badge> : null}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setCreateOpen(true)}>
            <Plus /> New household
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <CreateHouseholdDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
}

function MyBalancePill() {
  const { ledger, user } = useAppData();
  if (!ledger || !user) return null;
  const net = ledger.balances.get(user.id) ?? 0;
  return (
    <div className="rounded-xl border bg-card p-3 shadow-xs">
      <div className="flex items-center gap-2">
        <MemberAvatar id={user.id} name={user.displayName} src={user.avatarUrl} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{user.displayName}</p>
          <p className="text-xs text-muted-foreground">
            {net > 0 ? "You're owed" : net < 0 ? "You owe" : "All settled"}{" "}
            {net !== 0 ? <BalanceAmount cents={net} absolute className="text-xs" /> : null}
          </p>
        </div>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { status, error, reload, repo } = useAppData();
  const { openAddExpense, openSettleUp } = useDialogs();
  const ready = status === "ready";
  const current = NAV.find((n) => pathname.startsWith(n.href));

  return (
    <div className="flex min-h-dvh w-full">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-5 border-r bg-sidebar px-4 py-5 md:flex">
        <div className="flex items-center justify-between">
          <Logo />
          {repo.mode === "demo" ? (
            <Badge variant="outline" className="text-[10px]">
              Demo
            </Badge>
          ) : null}
        </div>
        {ready ? <HouseholdSwitcher /> : null}
        <nav className="flex flex-col gap-1">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto space-y-3">{ready ? <MyBalancePill /> : null}</div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur supports-backdrop-filter:bg-background/70">
          <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-4 md:h-16 md:px-8">
            <div className="md:hidden">{ready ? <HouseholdSwitcher className="max-w-[60vw] border-0 bg-transparent px-0 shadow-none hover:bg-transparent" /> : <Logo />}</div>
            <h1 className="hidden text-lg font-semibold tracking-tight md:block">{current?.label ?? "Roommate AI"}</h1>
            <div className="ml-auto flex items-center gap-2">
              {repo.mode === "demo" ? (
                <Badge variant="outline" className="md:hidden">
                  Demo
                </Badge>
              ) : null}
              {ready ? (
                <>
                  <Button variant="outline" onClick={() => openSettleUp()} className="hidden sm:inline-flex">
                    <HandCoins /> Settle up
                  </Button>
                  <Button onClick={() => openAddExpense()} className="hidden shadow-sm sm:inline-flex">
                    <Plus /> Add expense
                  </Button>
                </>
              ) : null}
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-5 pb-28 md:px-8 md:pt-8 md:pb-12">
          {status === "loading" ? <ShellLoading /> : null}
          {status === "error" ? <ShellError message={error} onRetry={reload} /> : null}
          {status === "no-households" ? <NoHouseholds /> : null}
          {ready ? children : null}
        </main>
      </div>

      {ready ? (
        <>
          <div className="fixed right-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-40 flex flex-col items-end gap-2 sm:hidden">
            <Button variant="outline" size="lg" className="rounded-full bg-card shadow-md" onClick={() => openSettleUp()}>
              <HandCoins /> Settle
            </Button>
            <Button size="lg" className="h-12 rounded-full px-5 text-base shadow-lg" onClick={() => openAddExpense()}>
              <Plus className="size-5" /> Add expense
            </Button>
          </div>
          <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
            <div className="grid grid-cols-5">
              {NAV.map(({ href, label, icon: Icon }) => {
                const active = pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium",
                      active ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    <Icon className="size-5" />
                    {label}
                  </Link>
                );
              })}
            </div>
          </nav>
        </>
      ) : null}
    </div>
  );
}

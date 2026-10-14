"use client";

import { ArrowRight, Home, Link2, LogOut, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useAppData } from "@/components/providers/app-data-provider";
import { useDialogs } from "@/components/providers/dialogs-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { parseInviteToken } from "@/lib/invite";
import { CreateHouseholdForm } from "./create-household-form";

export type HouseholdSetupTab = "create" | "join";

export function JoinHouseholdForm({ autoFocus }: { autoFocus?: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const token = parseInviteToken(value);
    if (!token) {
      setError(value.trim() ? "That doesn't look like an invite link or code. Copy the whole link your roommate sent." : "Paste the invite link or code.");
      return;
    }
    router.push(`/join/${token}`);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="invite-link">Invite link or code</Label>
        <Input
          id="invite-link"
          autoFocus={autoFocus}
          placeholder="https://…/join/3f9a… or the code"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          aria-invalid={Boolean(error)}
          autoComplete="off"
          spellCheck={false}
          className="h-10 font-mono text-xs"
        />
        {error ? <p className="text-xs text-destructive">{error}</p> : <p className="text-xs text-muted-foreground">Ask a roommate to share one from Settings.</p>}
      </div>
      <Button type="submit" className="w-full" size="lg">
        Continue <ArrowRight />
      </Button>
    </form>
  );
}

function SetupTabs({ initial, onCreated, autoFocus }: { initial: HouseholdSetupTab; onCreated?: () => void; autoFocus?: boolean }) {
  const [tab, setTab] = useState<HouseholdSetupTab>(initial);
  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as HouseholdSetupTab)} className="gap-4">
      <TabsList className="w-full rounded-xl bg-black/30">
        <TabsTrigger value="create">
          <Plus /> Create one
        </TabsTrigger>
        <TabsTrigger value="join">
          <Link2 /> Join one
        </TabsTrigger>
      </TabsList>
      <TabsContent value="create">
        <CreateHouseholdForm onDone={onCreated} autoFocus={autoFocus} />
      </TabsContent>
      <TabsContent value="join">
        <JoinHouseholdForm autoFocus={autoFocus} />
      </TabsContent>
    </Tabs>
  );
}

export function HouseholdDialog({
  open,
  onOpenChange,
  tab,
  formKey,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tab: HouseholdSetupTab;
  formKey: number;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{tab === "join" ? "Join a household" : "New household"}</DialogTitle>
          <DialogDescription>
            {tab === "join" ? "Paste the invite link a roommate sent you." : "Start a separate ledger — an apartment, a trip, a shared car."}
          </DialogDescription>
        </DialogHeader>
        {open ? <SetupTabs key={formKey} initial={tab} onCreated={() => onOpenChange(false)} autoFocus /> : null}
      </DialogContent>
    </Dialog>
  );
}

export function SignOutButton({ className }: { className?: string }) {
  const { repo } = useAppData();
  const router = useRouter();
  if (repo.mode !== "supabase") return null;
  return (
    <Button
      variant="ghost"
      size="sm"
      className={className}
      onClick={async () => {
        await repo.signOut();
        router.replace("/login");
        router.refresh();
      }}
    >
      <LogOut /> Sign out
    </Button>
  );
}

/** First-run card for someone who isn't in any household yet. */
export function HouseholdSetupCard() {
  const { user, skipSetup } = useAppData();
  return (
    <Card className="mx-auto max-w-md glow-soft">
      <CardContent className="space-y-5 py-8">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-accent-foreground ring-1 ring-primary/25 shadow-[0_0_24px_-6px] shadow-primary/60">
            <Home className="size-5" />
          </span>
          <h2 className="font-display text-2xl font-medium tracking-tight">Set up your household</h2>
          <p className="text-sm text-muted-foreground">
            Create one for your place and invite your roommates, or join theirs with the link they sent you.
          </p>
        </div>
        <SetupTabs initial="create" autoFocus />
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-4">
          <Button variant="ghost" size="sm" onClick={skipSetup} className="text-muted-foreground">
            Skip for now
          </Button>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            {user ? <span className="max-w-40 truncate">{user.displayName}</span> : null}
            <SignOutButton className="h-7 px-2 text-xs" />
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

const EMPTY_COPY: { prefix: string; title: string; body: string }[] = [
  { prefix: "/expenses", title: "No expenses to show", body: "Expenses live inside a household. Create one or join your roommates' to start logging what you pay for." },
  { prefix: "/balances", title: "Nothing to balance yet", body: "Once you're in a household, everyone's net balance and who-pays-whom show up here." },
  { prefix: "/activity", title: "No activity yet", body: "Expenses, payments and new roommates appear here once you're part of a household." },
];

/** Shown on app pages while a user who skipped setup has no household. */
export function NoHouseholdState({ pathname }: { pathname: string }) {
  const { openHousehold } = useDialogs();
  const copy = EMPTY_COPY.find((c) => pathname.startsWith(c.prefix)) ?? {
    title: "You're not in a household yet",
    body: "Roommate AI tracks shared costs per household. Start one for your place, or join the one your roommates already use.",
  };
  return (
    <Card className="mx-auto max-w-lg glow-soft">
      <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-accent-foreground ring-1 ring-primary/25 shadow-[0_0_24px_-6px] shadow-primary/60">
          <Home className="size-5" />
        </span>
        <div className="space-y-1.5">
          <h2 className="font-display text-xl font-medium tracking-tight">{copy.title}</h2>
          <p className="mx-auto max-w-sm text-sm text-muted-foreground">{copy.body}</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <Button onClick={() => openHousehold("create")} className="h-10 px-5">
            <Plus strokeWidth={2.5} /> Create household
          </Button>
          <Button variant="outline" onClick={() => openHousehold("join")} className="h-10 px-5">
            <Link2 /> Join household
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

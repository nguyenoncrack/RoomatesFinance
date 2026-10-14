"use client";

import { Check, Copy, Home, Link2, Loader2, Plus, RotateCcw, UserMinus, UserRoundCog } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { SignOutButton } from "@/components/layout/household-setup";
import { useAppData, useDemoRepository } from "@/components/providers/app-data-provider";
import { useDialogs } from "@/components/providers/dialogs-provider";
import { MemberAvatar } from "@/components/shared/member-avatar";
import { BalanceAmount } from "@/components/shared/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { BuddyCard } from "./buddy-card";
import { DeleteAccountCard } from "./delete-account-card";
import { SettleDayCard } from "./settle-day-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCents } from "@/lib/domain/money";
import { formatTimestamp } from "@/lib/format";

function useAsync() {
  const [busy, setBusy] = useState<string | null>(null);
  async function run(key: string, fn: () => Promise<unknown>, success?: string) {
    setBusy(key);
    try {
      await fn();
      if (success) toast.success(success);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }
  return { busy, run };
}

export function SettingsView() {
  const { snapshot, user, status } = useAppData();
  if (status === "no-households") return <NoHouseholdSettings key={user?.id} />;
  return <SettingsInner key={`${snapshot?.household.id}:${user?.id}`} />;
}

function ProfileCard() {
  const { user, repo, reload } = useAppData();
  const { busy, run } = useAsync();
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  if (!user) return null;

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    await run("profile", async () => {
      await repo.updateProfile(displayName);
      await reload();
    }, "Name updated");
  }

  return (
    <Card tone="blush" doodle="card">
      <CardHeader>
        <CardTitle>Your profile</CardTitle>
      </CardHeader>
      <form onSubmit={saveProfile}>
        <CardContent className="space-y-1.5">
          <Label htmlFor="display-name">Display name</Label>
          <Input id="display-name" value={displayName} maxLength={60} onChange={(e) => setDisplayName(e.target.value)} />
        </CardContent>
        <CardFooter className="mt-4">
          <Button type="submit" size="sm" disabled={busy === "profile" || !displayName.trim() || displayName.trim() === user.displayName}>
            {busy === "profile" ? <Loader2 className="animate-spin" /> : null} Save
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

function DemoControls() {
  const { user, reload } = useAppData();
  const demo = useDemoRepository();
  if (!demo || !user) return null;
  return (
    <Card tone="lilac" className="border-dashed">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserRoundCog className="size-4" /> Demo controls
        </CardTitle>
        <CardDescription>
          Data lives in this browser&apos;s localStorage. Connect Supabase (see README) for real accounts and sync.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-1.5">
          <Label>View the app as</Label>
          <Select
            value={user.id}
            onValueChange={async (id) => {
              demo.switchUser(id);
              await reload();
              toast.success("Switched roommate");
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {demo.listProfiles().map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.displayName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          variant="outline"
          onClick={async () => {
            demo.resetDemo();
            window.localStorage.removeItem("roommate-ai:active-household");
            await reload();
            toast.success("Demo data reset");
          }}
        >
          <RotateCcw /> Reset demo data
        </Button>
      </CardContent>
    </Card>
  );
}

function NoHouseholdSettings() {
  const { openHousehold } = useDialogs();
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <h2 className="text-2xl font-semibold tracking-tight md:hidden">Settings</h2>
      <Card tone="butter" doodle="house">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Home className="size-4" /> Household
          </CardTitle>
          <CardDescription>You&apos;re not in a household yet. Start one for your place, or join your roommates with their invite link.</CardDescription>
        </CardHeader>
        <CardFooter className="flex flex-wrap gap-2">
          <Button onClick={() => openHousehold("create")}>
            <Plus strokeWidth={2.5} /> Create household
          </Button>
          <Button variant="outline" onClick={() => openHousehold("join")}>
            <Link2 /> Join household
          </Button>
        </CardFooter>
      </Card>
      <ProfileCard />
      <DemoControls />
      <BuddyCard />
      <DeleteAccountCard />
      <div className="flex justify-end">
        <SignOutButton />
      </div>
    </div>
  );
}

function SettingsInner() {
  const { snapshot, ledger, user, repo, reload } = useAppData();
  const { openHousehold } = useDialogs();
  const { busy, run } = useAsync();
  const [householdName, setHouseholdName] = useState(snapshot?.household.name ?? "");
  const [invite, setInvite] = useState<{ url: string; expiresAt: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmingKick, setConfirmingKick] = useState<string | null>(null);

  if (!snapshot || !ledger || !user) return null;
  const me = ledger.memberById.get(user.id);
  const isOwner = me?.role === "owner";
  const myBalance = ledger.balances.get(user.id) ?? 0;
  const activeMembers = snapshot.members.filter((m) => m.leftAt === null);
  const formerMembers = snapshot.members.filter((m) => m.leftAt !== null);

  async function saveHousehold(e: FormEvent) {
    e.preventDefault();
    await run("household", async () => {
      await repo.renameHousehold(snapshot!.household.id, householdName);
      await reload();
    }, "Household renamed");
  }

  async function createInvite() {
    await run("invite", async () => {
      const created = await repo.createInvite(snapshot!.household.id);
      setInvite({ url: `${window.location.origin}/join/${created.token}`, expiresAt: created.expiresAt });
      setCopied(false);
    });
  }

  async function copyInvite() {
    if (!invite) return;
    await navigator.clipboard.writeText(invite.url).catch(() => undefined);
    setCopied(true);
    toast.success("Invite link copied");
  }

  async function kick(memberId: string, displayName: string) {
    await run(`kick:${memberId}`, async () => {
      await repo.kickMember(snapshot!.household.id, memberId);
      setConfirmingKick(null);
      await reload();
    }, `${displayName} was removed`);
  }

  async function leave() {
    const { id, name } = snapshot!.household;
    await run("leave", async () => {
      await repo.leaveHousehold(id);
      await reload();
    }, `You left ${name}`);
  }

  return (
    <div className="stagger-children mx-auto max-w-3xl space-y-5">
      <h2 className="text-2xl font-semibold tracking-tight md:hidden">Settings</h2>

      <Card tone="mint" doodle="people">
        <CardHeader>
          <CardTitle>Roommates</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="divide-y rounded-2xl bg-card/60 sketch-line">
            {activeMembers.map((m) => {
              const balance = ledger.balances.get(m.id) ?? 0;
              const canKick = isOwner && m.id !== user.id;
              return (
                <li key={m.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                  <MemberAvatar id={m.id} name={m.displayName} src={m.avatarUrl} />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate font-hand text-lg leading-tight">
                      {m.displayName}
                      {m.id === user.id ? <Badge variant="secondary">You</Badge> : null}
                      {m.role === "owner" ? <Badge variant="outline">Owner</Badge> : null}
                    </p>
                    <p className="text-xs text-muted-foreground">Joined {formatTimestamp(m.joinedAt)}</p>
                  </div>
                  <BalanceAmount cents={balance} className="font-hand text-xl font-normal" />
                  {canKick ? (
                    confirmingKick === m.id ? (
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setConfirmingKick(null)} disabled={busy === `kick:${m.id}`}>
                          Cancel
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => kick(m.id, m.displayName)} disabled={busy === `kick:${m.id}`}>
                          {busy === `kick:${m.id}` ? <Loader2 className="animate-spin" /> : <UserMinus />} Kick
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        disabled={balance !== 0}
                        title={balance === 0 ? `Remove ${m.displayName}` : "Settle their balance before removing them."}
                        onClick={() => setConfirmingKick(m.id)}
                      >
                        <UserMinus /> {balance === 0 ? "Kick" : "Settle first"}
                      </Button>
                    )
                  ) : null}
                </li>
              );
            })}
          </ul>
          {formerMembers.length ? (
            <p className="text-xs text-muted-foreground">
              Former roommates: {formerMembers.map((m) => m.displayName).join(", ")} — their history stays in the ledger.
            </p>
          ) : null}

          <div className="space-y-2 rounded-xl bg-muted/50 p-4">
            <p className="flex items-center gap-2 text-sm font-medium">
              <Link2 className="size-4" /> Invite roommates
            </p>
            <p className="text-xs text-muted-foreground">
              Links are single-purpose, expire after 7 days, and work for up to 5 people. Only a hash of the token is stored.
              {repo.mode === "demo" ? " In demo mode the link works in this browser and adds a new local roommate." : ""}
            </p>
            {invite ? (
              <div className="flex gap-2">
                <Input readOnly value={invite.url} className="h-9 font-mono text-xs" onFocus={(e) => e.currentTarget.select()} aria-label="Invite link" />
                <Button variant="outline" onClick={copyInvite}>
                  {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy"}
                </Button>
              </div>
            ) : null}
            <Button onClick={createInvite} disabled={busy === "invite"} variant={invite ? "ghost" : "default"} size="sm">
              {busy === "invite" ? <Loader2 className="animate-spin" /> : null}
              {invite ? "Generate a new link" : "Create invite link"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5 md:grid-cols-2">
        <ProfileCard />

        <Card tone="butter" doodle="house">
          <CardHeader>
            <CardTitle>Household</CardTitle>
            <CardDescription>{isOwner ? "You're the owner." : "Only the owner can rename it."}</CardDescription>
          </CardHeader>
          <form onSubmit={saveHousehold}>
            <CardContent className="space-y-1.5">
              <Label htmlFor="household-rename">Name</Label>
              <Input id="household-rename" value={householdName} maxLength={80} disabled={!isOwner} onChange={(e) => setHouseholdName(e.target.value)} />
            </CardContent>
            <CardFooter className="mt-4">
              <Button type="submit" size="sm" disabled={!isOwner || busy === "household" || householdName.trim() === snapshot.household.name}>
                {busy === "household" ? <Loader2 className="animate-spin" /> : null} Rename
              </Button>
              <Button type="button" variant="ghost" size="sm" className="ml-auto text-muted-foreground" onClick={() => openHousehold("join")}>
                <Link2 /> Join another
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>

      <SettleDayCard />

      <DemoControls />

      <Card tone="blush">
        <CardHeader>
          <CardTitle>Leave household</CardTitle>
          <CardDescription>
            {myBalance === 0
              ? "You're settled up, so you can leave. Your past expenses stay in the household's history."
              : `Settle your balance (${formatCents(myBalance, { signed: true })}) before leaving so nobody is left holding your share.`}
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex flex-wrap gap-2">
          <Button variant="destructive" disabled={myBalance !== 0 || busy === "leave"} onClick={leave}>
            {busy === "leave" ? <Loader2 className="animate-spin" /> : null} Leave {snapshot.household.name}
          </Button>
          <SignOutButton />
        </CardFooter>
      </Card>

      <BuddyCard />

      <DeleteAccountCard />
    </div>
  );
}

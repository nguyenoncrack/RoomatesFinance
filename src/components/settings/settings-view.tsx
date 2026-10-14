"use client";

import { Check, Copy, Link2, Loader2, LogOut, RotateCcw, UserRoundCog } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useAppData, useDemoRepository } from "@/components/providers/app-data-provider";
import { MemberAvatar } from "@/components/shared/member-avatar";
import { BalanceAmount } from "@/components/shared/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
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
  const { snapshot, user } = useAppData();
  return <SettingsInner key={`${snapshot?.household.id}:${user?.id}`} />;
}

function SettingsInner() {
  const { snapshot, ledger, user, repo, reload } = useAppData();
  const demo = useDemoRepository();
  const router = useRouter();
  const { busy, run } = useAsync();
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [householdName, setHouseholdName] = useState(snapshot?.household.name ?? "");
  const [invite, setInvite] = useState<{ url: string; expiresAt: string } | null>(null);
  const [copied, setCopied] = useState(false);

  if (!snapshot || !ledger || !user) return null;
  const me = ledger.memberById.get(user.id);
  const isOwner = me?.role === "owner";
  const myBalance = ledger.balances.get(user.id) ?? 0;
  const activeMembers = snapshot.members.filter((m) => m.leftAt === null);
  const formerMembers = snapshot.members.filter((m) => m.leftAt !== null);

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    await run("profile", async () => {
      await repo.updateProfile(displayName);
      await reload();
    }, "Name updated");
  }

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

  async function leave() {
    const { id, name } = snapshot!.household;
    await run("leave", async () => {
      await repo.leaveHousehold(id);
      await reload();
    }, `You left ${name}`);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <h2 className="text-2xl font-semibold tracking-tight md:hidden">Settings</h2>

      <Card>
        <CardHeader>
          <CardTitle>Roommates</CardTitle>
          <CardDescription>Everyone in {snapshot.household.name}.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="divide-y rounded-xl border">
            {activeMembers.map((m) => (
              <li key={m.id} className="flex items-center gap-3 px-3 py-2.5">
                <MemberAvatar id={m.id} name={m.displayName} src={m.avatarUrl} />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 truncate text-sm font-medium">
                    {m.displayName}
                    {m.id === user.id ? <Badge variant="secondary">You</Badge> : null}
                    {m.role === "owner" ? <Badge variant="outline">Owner</Badge> : null}
                  </p>
                  <p className="text-xs text-muted-foreground">Joined {formatTimestamp(m.joinedAt)}</p>
                </div>
                <BalanceAmount cents={ledger.balances.get(m.id) ?? 0} className="text-sm" />
              </li>
            ))}
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
        <Card>
          <CardHeader>
            <CardTitle>Your profile</CardTitle>
          </CardHeader>
          <form onSubmit={saveProfile}>
            <CardContent className="space-y-1.5">
              <Label htmlFor="display-name">Display name</Label>
              <Input id="display-name" value={displayName} maxLength={60} onChange={(e) => setDisplayName(e.target.value)} />
            </CardContent>
            <CardFooter className="mt-4">
              <Button type="submit" size="sm" disabled={busy === "profile" || displayName.trim() === user.displayName}>
                {busy === "profile" ? <Loader2 className="animate-spin" /> : null} Save
              </Button>
            </CardFooter>
          </form>
        </Card>

        <Card>
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
            </CardFooter>
          </form>
        </Card>
      </div>

      {demo ? (
        <Card className="border-dashed">
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
      ) : null}

      <Card className="border-negative/20">
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
          {repo.mode === "supabase" ? (
            <Button
              variant="ghost"
              onClick={async () => {
                await repo.signOut();
                router.replace("/login");
                router.refresh();
              }}
            >
              <LogOut /> Sign out
            </Button>
          ) : null}
        </CardFooter>
      </Card>
    </div>
  );
}

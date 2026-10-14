"use client";

import { Home, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Logo } from "@/components/shared/logo";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { getRepository, type InvitePreview } from "@/lib/data";
import type { Profile } from "@/lib/domain/types";

export function JoinView({ token }: { token: string }) {
  const repo = useMemo(() => getRepository(), []);
  const router = useRouter();
  const [state, setState] = useState<{ loading: boolean; preview: InvitePreview | null; user: Profile | null; isMember: boolean }>({
    loading: true,
    preview: null,
    user: null,
    isMember: false,
  });
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [preview, user] = await Promise.all([
        repo.previewInvite(token),
        repo.mode === "supabase" ? repo.getCurrentUser() : Promise.resolve(null),
      ]);
      const isMember = Boolean(preview && user && (await repo.listHouseholds()).some((h) => h.id === preview.householdId));
      if (!cancelled) setState({ loading: false, preview, user, isMember });
    })().catch((e) => {
      if (cancelled) return;
      setError(e instanceof Error ? e.message : "Couldn't check this invite.");
      setState({ loading: false, preview: null, user: null, isMember: false });
    });
    return () => {
      cancelled = true;
    };
  }, [repo, token]);

  async function accept(e?: FormEvent) {
    e?.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const householdId = await repo.acceptInvite(token, name);
      window.localStorage.setItem("roommate-ai:active-household", householdId);
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't join this household.");
      setBusy(false);
    }
  }

  const { loading, preview, user, isMember } = state;
  const openHousehold = () => {
    if (preview) window.localStorage.setItem("roommate-ai:active-household", preview.householdId);
    router.replace("/dashboard");
  };

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-terminal px-4 py-10">
      <div className="pointer-events-none absolute inset-0 bg-grid" aria-hidden />
      <div className="relative w-full max-w-sm space-y-6">
        <div className="flex justify-center">
          <Logo />
        </div>
        <Card className="glow-soft">
          {loading ? (
            <CardContent className="space-y-3 py-6">
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-10 w-full" />
            </CardContent>
          ) : preview && isMember ? (
            <>
              <CardHeader>
                <span className="mb-2 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-accent-foreground ring-1 ring-primary/25">
                  <Home className="size-5" />
                </span>
                <CardTitle>You&apos;re already in {preview.householdName}</CardTitle>
                <CardDescription>This invite is for a household you belong to, so there&apos;s nothing to join.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full glow-primary" size="lg" onClick={openHousehold}>
                  Open {preview.householdName}
                </Button>
              </CardContent>
            </>
          ) : !preview || !preview.isValid ? (
            <>
              <CardHeader>
                <CardTitle>This invite doesn&apos;t work</CardTitle>
                <CardDescription>
                  {preview ? "It has expired or reached its limit." : "The link is invalid."} Ask a roommate for a fresh link.
                  {repo.mode === "demo" ? " (Demo invites only work in the browser that created them.)" : ""}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="outline" className="w-full">
                  <Link href="/dashboard">Go to dashboard</Link>
                </Button>
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader>
                <span className="mb-2 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-accent-foreground ring-1 ring-primary/25">
                  <Home className="size-5" />
                </span>
                <CardTitle>Join {preview.householdName}</CardTitle>
                <CardDescription>
                  {preview.memberCount === 1
                    ? "1 roommate already tracks shared expenses here."
                    : `${preview.memberCount} roommates already track shared expenses here.`}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {repo.mode === "demo" ? (
                  <form onSubmit={accept} className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="join-name">Your name</Label>
                      <Input id="join-name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sam Rivera" />
                    </div>
                    <Button type="submit" className="w-full" size="lg" disabled={busy || !name.trim()}>
                      {busy ? <Loader2 className="animate-spin" /> : null} Join household
                    </Button>
                  </form>
                ) : user ? (
                  <Button className="w-full glow-primary" size="lg" onClick={() => accept()} disabled={busy}>
                    {busy ? <Loader2 className="animate-spin" /> : null} Join as {user.displayName}
                  </Button>
                ) : (
                  <Button asChild className="w-full" size="lg">
                    <Link href={`/login?next=${encodeURIComponent(`/join/${token}`)}`}>Sign in to join</Link>
                  </Button>
                )}
                {error ? (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                ) : null}
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

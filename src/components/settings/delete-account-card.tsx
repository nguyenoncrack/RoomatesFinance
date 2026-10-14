"use client";

import { Loader2, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useAppData } from "@/components/providers/app-data-provider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DELETE_ACCOUNT_CONFIRMATION,
  deleteAccountBlocks,
  describeDeleteAccountBlock,
  type DeleteAccountHousehold,
} from "@/lib/domain/account";

/**
 * Danger zone: permanently delete your account. The checks you can see here come from the household
 * that's open; the server checks all of your households again and explains anything that blocks it.
 */
export function DeleteAccountCard() {
  const { snapshot, ledger, user, repo } = useAppData();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!user) return null;

  const households: DeleteAccountHousehold[] = [];
  if (snapshot && ledger) {
    const active = snapshot.members.filter((m) => m.leftAt === null);
    const me = active.find((m) => m.id === user.id);
    if (me) {
      households.push({
        name: snapshot.household.name,
        role: me.role,
        activeMemberCount: active.length,
        otherOwnerCount: active.filter((m) => m.role === "owner" && m.id !== user.id).length,
        netBalanceCents: ledger.balances.get(user.id) ?? 0,
      });
    }
  }
  const blocks = deleteAccountBlocks(households);
  const confirmed = typed.trim() === DELETE_ACCOUNT_CONFIRMATION;

  function reset(next: boolean) {
    setOpen(next);
    if (!next) {
      setTyped("");
      setError(null);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!confirmed || busy) return;
    setBusy(true);
    setError(null);
    try {
      await repo.deleteOwnAccount();
      toast.success("Your account was deleted", { description: "Your past expenses stay with your roommates as “Deleted user”." });
      if (repo.mode === "supabase") {
        router.replace("/login");
        router.refresh();
      } else {
        window.location.reload();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't delete your account.");
      setBusy(false);
    }
  }

  return (
    <>
      <Card tone="blush" doodle="gear">
        <CardHeader>
          <CardTitle>Delete account</CardTitle>
          <CardDescription className="text-foreground/75">
            Closes your login for good. Expenses and payments you were part of stay for your roommates, under the name “Deleted user”.
          </CardDescription>
        </CardHeader>
        {blocks.length > 0 ? (
          <CardContent>
            <ul className="space-y-1.5 font-hand text-lg leading-tight">
              {blocks.map((b, i) => (
                <li key={i} className="flex gap-2">
                  <TriangleAlert className="mt-1 size-4 shrink-0 text-negative" strokeWidth={2} />
                  {describeDeleteAccountBlock(b)}
                </li>
              ))}
            </ul>
          </CardContent>
        ) : null}
        <CardFooter className="bg-transparent">
          <Button variant="destructive" onClick={() => setOpen(true)} disabled={blocks.length > 0}>
            Delete my account
          </Button>
        </CardFooter>
      </Card>

      <Dialog open={open} onOpenChange={reset}>
        <DialogContent className="gap-0 p-0 sm:max-w-md">
          <form onSubmit={onSubmit} noValidate>
            <DialogHeader className="border-b px-5 pt-5 pb-4">
              <DialogTitle>Delete your account?</DialogTitle>
              <DialogDescription>
                {repo.mode === "demo"
                  ? "This is a demo, so deleting just resets the demo data."
                  : "You'll be signed out and can't get back in. This can't be undone."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 px-5 py-5">
              <div className="space-y-1.5">
                <Label htmlFor="delete-confirm">
                  Type <b>{DELETE_ACCOUNT_CONFIRMATION}</b> to confirm
                </Label>
                <Input
                  id="delete-confirm"
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  className="h-11"
                />
              </div>
              {error ? (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}
            </div>
            <DialogFooter className="border-t bg-muted/40 px-5 py-3">
              <Button type="button" variant="ghost" onClick={() => reset(false)} disabled={busy}>
                Keep my account
              </Button>
              <Button type="submit" variant="destructive" disabled={!confirmed || busy}>
                {busy ? <Loader2 className="animate-spin" /> : null} Delete forever
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

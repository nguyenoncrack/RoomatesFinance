"use client";

import { formatDistanceToNowStrict, parseISO } from "date-fns";
import { Check, Copy, Loader2, RefreshCw, Share2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAppData } from "@/components/providers/app-data-provider";
import { PeopleDoodle } from "@/components/shared/doodles";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export function InviteDialog({ open, onOpenChange, formKey }: { open: boolean; onOpenChange: (open: boolean) => void; formKey: number }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 p-0 max-sm:top-auto max-sm:bottom-0 max-sm:left-0 max-sm:max-w-full max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-b-none sm:max-w-md">
        {open ? <InviteBody key={formKey} /> : null}
      </DialogContent>
    </Dialog>
  );
}

/** Creates a fresh link the moment it opens, so inviting is one tap and one copy. */
function InviteBody() {
  const { snapshot, repo } = useAppData();
  const householdId = snapshot?.household.id;
  const householdName = snapshot?.household.name ?? "your household";
  const [invite, setInvite] = useState<{ url: string; expiresAt: string } | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  async function create() {
    if (!householdId) return;
    try {
      const created = await repo.createInvite(householdId);
      setInvite({ url: `${window.location.origin}/join/${created.token}`, expiresAt: created.expiresAt });
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't create an invite link.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    // Runs once when the dialog opens (each open mounts a fresh body); state only changes after the request.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void create();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function regenerate() {
    setBusy(true);
    setCopied(false);
    void create();
  }

  async function copy() {
    if (!invite) return;
    try {
      await navigator.clipboard.writeText(invite.url);
      setCopied(true);
      toast.success("Invite link copied");
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      toast.error("Couldn't copy. Select the link and copy it manually.");
    }
  }

  async function share() {
    if (!invite) return;
    try {
      await navigator.share({ title: `Join ${householdName}`, text: `Join ${householdName} on PennyPincher`, url: invite.url });
    } catch {
      // Dismissed the share sheet: nothing to do.
    }
  }

  return (
    <>
      <DialogHeader className="flex-row items-center gap-3 border-b px-5 pt-5 pb-4">
        <PeopleDoodle className="size-12 shrink-0" />
        <div className="min-w-0">
          <DialogTitle className="text-2xl">Invite roommates</DialogTitle>
          <DialogDescription className="font-hand text-lg leading-tight">to {householdName}</DialogDescription>
        </div>
      </DialogHeader>
      <div className="space-y-4 px-5 py-5">
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : (
          <>
            <div className="flex gap-2">
              <Input
                readOnly
                value={busy && !invite ? "Making your link…" : (invite?.url ?? "")}
                aria-label="Invite link"
                onFocus={(e) => e.currentTarget.select()}
                className="h-11 font-mono text-xs"
              />
              <Button variant="pop" onClick={copy} disabled={!invite || busy} className="h-11 shrink-0">
                {busy && !invite ? <Loader2 className="animate-spin" /> : copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <p className="font-hand text-lg leading-tight text-muted-foreground">
              {invite ? `Works for 5 people · expires in ${formatDistanceToNowStrict(parseISO(invite.expiresAt))}` : " "}
            </p>
          </>
        )}
      </div>
      <div className="flex items-center justify-between gap-2 border-t bg-muted/40 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <Button variant="ghost" size="sm" onClick={regenerate} disabled={busy}>
          {busy ? <Loader2 className="animate-spin" /> : <RefreshCw />} New link
        </Button>
        {canShare && invite ? (
          <Button variant="mint" onClick={share}>
            <Share2 /> Share
          </Button>
        ) : null}
      </div>
    </>
  );
}

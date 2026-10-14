"use client";

import { ArrowRight, Loader2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { celebrate } from "@/components/shared/celebration";
import { useAppData } from "@/components/providers/app-data-provider";
import { MemberAvatar } from "@/components/shared/member-avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { amountInputError, centsToInput, formatCents, parseCents } from "@/lib/domain/money";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS, type PaymentMethod } from "@/lib/domain/types";
import { firstName } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface SettleUpPrefill {
  direction: "pay" | "receive";
  counterpartyId?: string;
  amountCents?: number;
}

export function SettleUpDialog({
  open,
  onOpenChange,
  prefill,
  formKey,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefill: SettleUpPrefill | null;
  formKey: number;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="gap-0 p-0 max-sm:top-auto max-sm:bottom-0 max-sm:left-0 max-sm:max-w-full max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-b-none sm:max-w-md"
        onOpenAutoFocus={(e) => {
          if (window.matchMedia("(max-width: 640px)").matches) e.preventDefault();
        }}
      >
        {open ? <SettleUpForm key={formKey} prefill={prefill} onDone={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function SettleUpForm({ prefill, onDone }: { prefill: SettleUpPrefill | null; onDone: () => void }) {
  const { snapshot, ledger, user, recordSettlement } = useAppData();
  const me = user?.id ?? "";
  const others = snapshot?.members.filter((m) => m.leftAt === null && m.id !== me) ?? [];

  const suggestion = (direction: "pay" | "receive", otherId: string) =>
    ledger?.simplified.find((t) =>
      direction === "pay" ? t.from === me && t.to === otherId : t.from === otherId && t.to === me,
    )?.amountCents ?? 0;

  const defaultDirection: "pay" | "receive" =
    prefill?.direction ?? (ledger?.simplified.some((t) => t.from === me) ? "pay" : "receive");
  const defaultOther =
    prefill?.counterpartyId ??
    ledger?.simplified.find((t) => (defaultDirection === "pay" ? t.from === me : t.to === me))?.[defaultDirection === "pay" ? "to" : "from"] ??
    others[0]?.id ??
    "";

  const [clientRequestId] = useState(() => crypto.randomUUID());
  const [direction, setDirection] = useState<"pay" | "receive">(defaultDirection);
  const [other, setOther] = useState(defaultOther);
  const [amountInput, setAmountInput] = useState(() => {
    const c = prefill?.amountCents ?? suggestion(defaultDirection, defaultOther);
    return c > 0 ? centsToInput(c) : "";
  });
  const [method, setMethod] = useState<PaymentMethod>("venmo");
  const [completed, setCompleted] = useState(true);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amountCents = parseCents(amountInput);
  const suggested = suggestion(direction, other);
  const otherMember = others.find((m) => m.id === other);
  const otherName = otherMember ? (ledger?.shortName.get(otherMember.id) ?? firstName(otherMember.displayName)) : "them";

  function pick(nextDirection: "pay" | "receive", nextOther: string) {
    setDirection(nextDirection);
    setOther(nextOther);
    const c = suggestion(nextDirection, nextOther);
    setAmountInput(c > 0 ? centsToInput(c) : "");
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    if (!other) return setError("Pick who you're settling with.");
    const amountError = amountInputError(amountInput);
    if (amountError || amountCents === null) return setError(amountError ?? "Enter an amount greater than $0.");
    setSubmitting(true);
    try {
      await recordSettlement({
        paidBy: direction === "pay" ? me : other,
        paidTo: direction === "pay" ? other : me,
        amountCents,
        paymentMethod: method,
        status: completed ? "completed" : "pending",
        note: note.trim() || null,
        clientRequestId,
      });
      toast.success(completed ? "Payment recorded" : "Payment saved as pending", {
        description:
          direction === "pay"
            ? `You paid ${otherName} ${formatCents(amountCents)} via ${PAYMENT_METHOD_LABELS[method]}`
            : `${otherName} paid you ${formatCents(amountCents)} via ${PAYMENT_METHOD_LABELS[method]}`,
      });
      if (completed) celebrate("Payment recorded", { subtitle: `${formatCents(amountCents)} ${direction === "pay" ? "to" : "from"} ${otherName}`, priority: 1 });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't record this payment.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <DialogHeader className="border-b px-5 pt-5 pb-4">
        <DialogTitle className="text-lg font-semibold">Settle up</DialogTitle>
        <DialogDescription>Record a payment you made outside the app. No money moves here.</DialogDescription>
      </DialogHeader>

      <div className="space-y-5 px-5 py-5">
        <ToggleGroup
          type="single"
          variant="outline"
          value={direction}
          onValueChange={(v) => v && pick(v as "pay" | "receive", other)}
          className="w-full"
        >
          <ToggleGroupItem value="pay" className="flex-1">
            I paid someone
          </ToggleGroupItem>
          <ToggleGroupItem value="receive" className="flex-1">
            Someone paid me
          </ToggleGroupItem>
        </ToggleGroup>

        <div className="flex items-center gap-3 rounded-xl bg-muted/60 p-3">
          <MemberAvatar id={direction === "pay" ? me : other} name={direction === "pay" ? (user?.displayName ?? "You") : (otherMember?.displayName ?? "?")} />
          <ArrowRight className="size-4 text-muted-foreground" />
          <MemberAvatar id={direction === "pay" ? other : me} name={direction === "pay" ? (otherMember?.displayName ?? "?") : (user?.displayName ?? "You")} />
          <p className="ml-1 text-sm">
            {direction === "pay" ? (
              <>
                <b>You</b> pay <b>{otherName}</b>
              </>
            ) : (
              <>
                <b>{otherName}</b> pays <b>you</b>
              </>
            )}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>{direction === "pay" ? "Paid to" : "Received from"}</Label>
            <Select value={other} onValueChange={(v) => pick(direction, v)}>
              <SelectTrigger className="h-10 w-full" aria-label="Roommate">
                <SelectValue placeholder="Choose roommate" />
              </SelectTrigger>
              <SelectContent>
                {others.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="settle-amount">Amount</Label>
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground">$</span>
              <Input
                id="settle-amount"
                inputMode="decimal"
                placeholder="0.00"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                className="h-10 pl-6 text-base font-semibold tabular-nums"
              />
            </div>
          </div>
        </div>

        <p className="-mt-2 text-xs text-muted-foreground">
          {suggested > 0 ? (
            <>
              Suggested: {formatCents(suggested)} clears this in the simplified plan.
              {amountCents !== null && amountCents > 0 && amountCents < suggested ? " Partial payments are fine." : ""}
              {amountCents !== null && amountCents > suggested ? (
                <span className="text-amber-700"> That&apos;s more than owed; the extra will show as a new balance.</span>
              ) : null}
            </>
          ) : (
            <>Nothing is owed in this direction right now, so this payment will create a balance.</>
          )}
        </p>

        <div className="space-y-1.5">
          <Label>Method</Label>
          <div className="grid grid-cols-4 gap-2">
            {PAYMENT_METHODS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMethod(m)}
                aria-pressed={method === m}
                className={cn(
                  "rounded-lg border py-2 text-sm font-medium transition-colors",
                  method === m ? "border-primary bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted",
                )}
              >
                {PAYMENT_METHOD_LABELS[m]}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="settle-note">Note</Label>
          <Input id="settle-note" maxLength={280} placeholder="Optional" value={note} onChange={(e) => setNote(e.target.value)} className="h-10" />
        </div>

        <label className="flex items-center justify-between gap-3 rounded-xl border p-3">
          <span>
            <span className="block text-sm font-medium">Mark as completed</span>
            <span className="block text-xs text-muted-foreground">Pending payments don&apos;t change balances until completed.</span>
          </span>
          <Switch checked={completed} onCheckedChange={setCompleted} />
        </label>

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
      </div>

      <div className="flex justify-end gap-2 border-t bg-muted/40 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <Button type="button" variant="ghost" onClick={onDone} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" size="lg" disabled={submitting || others.length === 0} className="min-w-32">
          {submitting ? <Loader2 className="animate-spin" /> : null}
          Record payment
        </Button>
      </div>
    </form>
  );
}

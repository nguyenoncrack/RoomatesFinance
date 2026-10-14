"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Ban, CalendarClock, Clock, HandCoins, Pencil, Repeat, Trash2, Type, UserMinus, UserPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ExpenseDetailDialog } from "@/components/expenses/expense-detail-dialog";
import { useAppData } from "@/components/providers/app-data-provider";
import { ConfirmButtons, settlementRole } from "@/components/settlements/confirm";
import { CategoryIcon } from "@/components/shared/category";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ActivityItem } from "@/lib/activity";
import { formatCents } from "@/lib/domain/money";
import { PAYMENT_METHOD_LABELS, type Expense, type Settlement } from "@/lib/domain/types";
import { formatDay, relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

function SettlementActions({ s }: { s: Settlement }) {
  const { user, setSettlementStatus } = useAppData();
  const [busy, setBusy] = useState<"voided" | null>(null);
  const [confirmingVoid, setConfirmingVoid] = useState(false);
  if (!user || (s.paidBy !== user.id && s.paidTo !== user.id) || s.status === "voided" || s.status === "rejected" || s.id.startsWith("optimistic-")) return null;
  const { incoming, awaiting } = settlementRole(s, user.id);

  async function voidIt() {
    setBusy("voided");
    try {
      await setSettlementStatus(s.id, "voided");
      toast.success(s.status === "pending" ? "Payment cancelled" : "Payment voided", { description: s.status === "pending" ? undefined : "Balances updated." });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't update the payment.");
    } finally {
      setBusy(null);
    }
  }

  // The recipient confirms; only they can.
  if (incoming) return <ConfirmButtons settlement={s} size="xs" className="mt-2" />;

  if (confirmingVoid) {
    return (
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Void this {formatCents(s.amountCents)} payment? Balances go back to before it.</span>
        <Button size="xs" variant="ghost" onClick={() => setConfirmingVoid(false)} disabled={busy !== null}>
          Keep
        </Button>
        <Button size="xs" variant="destructive" onClick={voidIt} disabled={busy !== null}>
          <Ban /> Void payment
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-2 flex items-center gap-2">
      {awaiting ? <span className="font-hand text-base text-muted-foreground">Awaiting confirmation</span> : null}
      <Button
        size="xs"
        variant="ghost"
        className="text-muted-foreground"
        onClick={() => (s.status === "completed" ? setConfirmingVoid(true) : voidIt())}
        disabled={busy !== null}
      >
        <Ban /> {s.status === "pending" ? "Cancel" : "Void"}
      </Button>
    </div>
  );
}

/** Badge text for a non-completed settlement, from the viewer's side. */
function statusLabel(s: Settlement, userId: string | undefined): string {
  if (s.status === "pending") {
    if (s.paidTo === userId) return "needs your OK";
    return "awaiting confirmation";
  }
  return s.status;
}

export function ActivityFeed({
  items,
  showActions = false,
  twoColumn = false,
}: {
  items: ActivityItem[];
  showActions?: boolean;
  /** Flow items into two columns on wide screens (dashboard's full-width card). */
  twoColumn?: boolean;
}) {
  const { ledger, user } = useAppData();
  const [viewing, setViewing] = useState<Expense | null>(null);
  if (!ledger) return null;
  const name = (id: string | null) =>
    id === user?.id ? "You" : id ? (ledger.shortName.get(id) ?? "A former roommate") : "Someone";

  return (
    <>
      <ul className={cn("space-y-1", twoColumn && "lg:grid lg:grid-cols-2 lg:gap-x-6 lg:gap-y-1 lg:space-y-0")}>
        <AnimatePresence initial={false}>
          {items.map((item) => (
            <motion.li
              key={item.id}
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              {item.kind === "expense" ? (
                <button
                  onClick={() => setViewing(item.expense)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left transition-colors hover:bg-foreground/[0.05] focus-visible:bg-foreground/[0.05] focus-visible:outline-none",
                    item.expense.id.startsWith("optimistic-") && "opacity-60",
                  )}
                >
                  <CategoryIcon category={item.expense.category} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-hand text-lg leading-tight">
                      <b className="font-normal">{name(item.expense.paidBy)}</b> <span className="text-muted-foreground">paid for</span> {item.expense.title}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {formatDay(item.expense.expenseDate)} · split {item.expense.splits.length} way{item.expense.splits.length === 1 ? "" : "s"}
                    </span>
                  </span>
                  <span className="font-hand text-xl leading-none">{formatCents(item.expense.amountCents)}</span>
                </button>
              ) : item.kind === "settlement" ? (
                <div className={cn("flex items-start gap-3 rounded-xl px-2 py-2.5", (item.settlement.status === "voided" || item.settlement.status === "rejected") && "opacity-55")}>
                  <span
                    className={cn(
                      "inline-flex size-10 shrink-0 items-center justify-center rounded-full text-foreground sticker-sm",
                      item.settlement.status === "pending" ? "bg-butter" : item.settlement.status === "rejected" ? "bg-blush" : "bg-mint",
                    )}
                  >
                    {item.settlement.status === "pending" ? <Clock className="size-[18px]" strokeWidth={2} /> : <HandCoins className="size-[18px]" strokeWidth={2} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={cn("font-hand text-lg leading-tight", (item.settlement.status === "voided" || item.settlement.status === "rejected") && "line-through")}>
                      <b className="font-normal">{name(item.settlement.paidBy)}</b> <span className="text-muted-foreground">paid</span>{" "}
                      <b className="font-normal">{name(item.settlement.paidTo) === "You" ? "you" : name(item.settlement.paidTo)}</b>
                    </p>
                    <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      {PAYMENT_METHOD_LABELS[item.settlement.paymentMethod]} · {relativeTime(item.settlement.createdAt)}
                      {item.settlement.status !== "completed" ? (
                        <Badge
                          variant="outline"
                          className={cn(
                            "h-4 px-1.5 text-[10px]",
                            item.settlement.status === "pending" && "bg-butter",
                            item.settlement.status === "rejected" && "bg-blush text-negative",
                          )}
                        >
                          {statusLabel(item.settlement, user?.id)}
                        </Badge>
                      ) : null}
                      {item.settlement.note ? <span className="truncate">“{item.settlement.note}”</span> : null}
                    </p>
                    {showActions ? <SettlementActions s={item.settlement} /> : null}
                  </div>
                  <span className={cn("font-hand text-xl leading-none", item.settlement.status === "completed" ? "text-positive" : "text-muted-foreground")}>
                    {formatCents(item.settlement.amountCents)}
                  </span>
                </div>
              ) : (
                <AuditRow item={item} name={name} />
              )}
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      <ExpenseDetailDialog expense={viewing} onOpenChange={(o) => !o && setViewing(null)} />
    </>
  );
}

function AuditRow({ item, name }: { item: Extract<ActivityItem, { kind: "audit" }>; name: (id: string | null) => string }) {
  const e = item.event;
  const map: Record<string, { icon: typeof Pencil; text: string }> = {
    update: { icon: Pencil, text: `edited ${e.title ?? "an expense"}` },
    delete: { icon: Trash2, text: `deleted ${e.title ?? "an expense"}` },
    voided: { icon: Ban, text: "voided a payment" },
    join: { icon: UserPlus, text: "joined the household" },
    leave: { icon: UserMinus, text: "left the household" },
    kick: { icon: UserMinus, text: `removed ${e.title ?? "a roommate"}` },
    rename: { icon: Type, text: `renamed the household to ${e.title ?? ""}` },
    repeat: { icon: Repeat, text: `set ${e.title ?? "an expense"} to repeat` },
    stop_repeat: { icon: Repeat, text: `stopped repeating ${e.title ?? "an expense"}` },
    settle_day: { icon: CalendarClock, text: "changed the settle day" },
  };
  const meta = map[e.action] ?? { icon: Pencil, text: e.action };
  const Icon = meta.icon;
  return (
    <div className="flex items-center gap-3 rounded-xl px-2 py-2 text-muted-foreground">
      <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border-[1.5px] border-dashed border-foreground/40 bg-card text-foreground/70">
        <Icon className="size-[18px]" strokeWidth={2} />
      </span>
      <p className="min-w-0 flex-1 truncate text-sm">
        <b className="font-hand text-lg font-normal text-foreground">{name(e.actorId)}</b> {meta.text}
        <span className="block text-xs">{relativeTime(e.createdAt)}</span>
      </p>
      {e.amountCents !== null && (e.action === "delete" || e.action === "voided") ? (
        <span className="text-sm tabular-nums line-through">{formatCents(e.amountCents)}</span>
      ) : null}
    </div>
  );
}

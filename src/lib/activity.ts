import type { AuditEvent, Expense, HouseholdSnapshot, Settlement } from "@/lib/domain/types";

export type ActivityItem =
  | { kind: "expense"; id: string; at: string; expense: Expense }
  | { kind: "settlement"; id: string; at: string; settlement: Settlement }
  | { kind: "audit"; id: string; at: string; event: AuditEvent };

// Voided payments already show (struck through) as settlement rows, so they're not repeated here.
const AUDIT_ACTIONS = new Set(["update", "delete", "join", "leave", "rename"]);

/** Chronological feed (newest first) of expenses, payments, and notable edits. */
export function buildActivity(snapshot: HouseholdSnapshot): ActivityItem[] {
  const items: ActivityItem[] = [
    ...snapshot.expenses.map((expense) => ({ kind: "expense" as const, id: `e:${expense.id}`, at: expense.createdAt, expense })),
    ...snapshot.settlements.map((settlement) => ({
      kind: "settlement" as const,
      id: `s:${settlement.id}`,
      at: settlement.createdAt,
      settlement,
    })),
    ...snapshot.audit
      .filter((event) => AUDIT_ACTIONS.has(event.action))
      .map((event) => ({ kind: "audit" as const, id: `a:${event.id}`, at: event.createdAt, event })),
  ];
  return items.sort((a, b) => b.at.localeCompare(a.at));
}

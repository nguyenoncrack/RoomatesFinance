import { computeNetBalances, pairwiseDebts, simplifyDebts, summarizeMembers, type MemberBalance, type Transfer } from "@/lib/domain/balances";
import type { HouseholdSnapshot, Member } from "@/lib/domain/types";
import { shortNames } from "@/lib/format";

export interface Ledger {
  memberById: Map<string, Member>;
  /** Display label per member: first name, or full name when first names collide. */
  shortName: Map<string, string>;
  balances: Map<string, number>;
  summaries: MemberBalance[];
  simplified: Transfer[];
  original: Transfer[];
}

/** Everything the UI shows about money is derived here from the raw snapshot. */
export function buildLedger(snapshot: HouseholdSnapshot): Ledger {
  const memberIds = snapshot.members.filter((m) => m.leftAt === null).map((m) => m.id);
  const balances = computeNetBalances(memberIds, snapshot.expenses, snapshot.settlements);
  return {
    memberById: new Map(snapshot.members.map((m) => [m.id, m])),
    shortName: shortNames(snapshot.members),
    balances,
    summaries: summarizeMembers(memberIds, snapshot.expenses, snapshot.settlements),
    simplified: simplifyDebts(balances),
    original: pairwiseDebts(snapshot.expenses, snapshot.settlements),
  };
}

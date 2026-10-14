import { formatCents } from "./money";

export const DELETE_ACCOUNT_CONFIRMATION = "DELETE";

export interface DeleteAccountHousehold {
  name: string;
  role: "owner" | "member";
  /** Active members including the user. */
  activeMemberCount: number;
  /** Other active members who are also owners. */
  otherOwnerCount: number;
  netBalanceCents: number;
}

export type DeleteAccountBlock =
  | { code: "outstanding_balance"; householdName: string; balanceCents: number }
  | { code: "sole_owner_with_members"; householdName: string };

/**
 * Reasons a user cannot delete their account. History is never destroyed, but
 * outstanding money and an unowned household of roommates both block the action.
 * Balance is reported before ownership so they settle first.
 */
export function deleteAccountBlocks(households: DeleteAccountHousehold[]): DeleteAccountBlock[] {
  const blocks: DeleteAccountBlock[] = [];
  for (const h of households) {
    if (h.netBalanceCents !== 0) {
      blocks.push({
        code: "outstanding_balance",
        householdName: h.name,
        balanceCents: h.netBalanceCents,
      });
    }
    if (h.role === "owner" && h.activeMemberCount > 1 && h.otherOwnerCount === 0) {
      blocks.push({ code: "sole_owner_with_members", householdName: h.name });
    }
  }
  return blocks;
}

export function describeDeleteAccountBlock(block: DeleteAccountBlock): string {
  if (block.code === "outstanding_balance") {
    return `Settle your balance in ${block.householdName} (${formatCents(block.balanceCents, { signed: true })}) before deleting your account.`;
  }
  return `You're the owner of ${block.householdName} with other roommates. Leave or kick them first so someone else can own it.`;
}

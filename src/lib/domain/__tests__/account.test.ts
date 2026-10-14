import { describe, expect, it } from "vitest";
import { computeNetBalances } from "../balances";
import { createDemoState, DEMO_USERS } from "@/lib/data/demo-seed";
import {
  DELETE_ACCOUNT_CONFIRMATION,
  deleteAccountBlocks,
  describeDeleteAccountBlock,
  type DeleteAccountHousehold,
} from "../account";

function demoContexts(userId: string): DeleteAccountHousehold[] {
  const s = createDemoState();
  return s.members
    .filter((m) => m.id === userId && m.leftAt === null)
    .map((m) => {
      const h = s.households.find((x) => x.id === m.householdId)!;
      const active = s.members.filter((x) => x.householdId === m.householdId && x.leftAt === null);
      const balances = computeNetBalances(
        [],
        s.expenses.filter((e) => e.householdId === m.householdId && e.deletedAt === null),
        s.settlements.filter((x) => x.householdId === m.householdId),
      );
      return {
        name: h.name,
        role: m.role,
        activeMemberCount: active.length,
        otherOwnerCount: active.filter((x) => x.role === "owner" && x.id !== userId).length,
        netBalanceCents: balances.get(userId) ?? 0,
      };
    });
}

function household(partial: Partial<DeleteAccountHousehold> & Pick<DeleteAccountHousehold, "name">): DeleteAccountHousehold {
  return {
    role: "member",
    activeMemberCount: 3,
    otherOwnerCount: 1,
    netBalanceCents: 0,
    ...partial,
  };
}

describe("deleteAccountBlocks", () => {
  it("allows a member who is settled, including with no households", () => {
    expect(deleteAccountBlocks([])).toEqual([]);
    expect(deleteAccountBlocks([household({ name: "UCSB Apartment" })])).toEqual([]);
  });

  it("allows the only remaining roommate even if they are the owner", () => {
    expect(
      deleteAccountBlocks([
        household({ name: "Solo pad", role: "owner", activeMemberCount: 1, otherOwnerCount: 0 }),
      ]),
    ).toEqual([]);
  });

  it("allows an owner when another owner already exists", () => {
    expect(
      deleteAccountBlocks([
        household({ name: "Shared", role: "owner", activeMemberCount: 3, otherOwnerCount: 1 }),
      ]),
    ).toEqual([]);
  });

  it("blocks a non-zero balance in any household", () => {
    const blocks = deleteAccountBlocks([
      household({ name: "UCSB Apartment", netBalanceCents: 5000 }),
      household({ name: "Tahoe", netBalanceCents: 0 }),
    ]);
    expect(blocks).toEqual([{ code: "outstanding_balance", householdName: "UCSB Apartment", balanceCents: 5000 }]);
    expect(describeDeleteAccountBlock(blocks[0])).toContain("UCSB Apartment");
    expect(describeDeleteAccountBlock(blocks[0])).toContain("$50.00");
  });

  it("blocks a negative balance (they owe) the same way", () => {
    expect(deleteAccountBlocks([household({ name: "Apt", netBalanceCents: -1200 })])).toEqual([
      { code: "outstanding_balance", householdName: "Apt", balanceCents: -1200 },
    ]);
  });

  it("blocks the sole owner of a household that still has roommates", () => {
    const blocks = deleteAccountBlocks([
      household({ name: "UCSB Apartment", role: "owner", activeMemberCount: 4, otherOwnerCount: 0 }),
    ]);
    expect(blocks).toEqual([{ code: "sole_owner_with_members", householdName: "UCSB Apartment" }]);
    expect(describeDeleteAccountBlock(blocks[0])).toMatch(/Leave or kick/i);
  });

  it("reports balance before ownership when both apply", () => {
    expect(
      deleteAccountBlocks([
        household({
          name: "UCSB Apartment",
          role: "owner",
          activeMemberCount: 3,
          otherOwnerCount: 0,
          netBalanceCents: -4000,
        }),
      ]),
    ).toEqual([
      { code: "outstanding_balance", householdName: "UCSB Apartment", balanceCents: -4000 },
      { code: "sole_owner_with_members", householdName: "UCSB Apartment" },
    ]);
  });

  it("blocks a solo owner who still has a leftover balance with former roommates", () => {
    expect(
      deleteAccountBlocks([
        household({
          name: "Empty nest",
          role: "owner",
          activeMemberCount: 1,
          otherOwnerCount: 0,
          netBalanceCents: 250,
        }),
      ]),
    ).toEqual([{ code: "outstanding_balance", householdName: "Empty nest", balanceCents: 250 }]);
  });

  it("aggregates blocks across households", () => {
    const blocks = deleteAccountBlocks([
      household({ name: "Trip", netBalanceCents: 100 }),
      household({ name: "Apt", role: "owner", activeMemberCount: 2, otherOwnerCount: 0 }),
    ]);
    expect(blocks.map((b) => b.code)).toEqual(["outstanding_balance", "sole_owner_with_members"]);
  });
});

describe("DELETE_ACCOUNT_CONFIRMATION", () => {
  it("is the typed phrase the settings dialog requires", () => {
    expect(DELETE_ACCOUNT_CONFIRMATION).toBe("DELETE");
  });
});

describe("seeded demo household", () => {
  it("blocks Maya (sole owner of UCSB Apartment with roommates)", () => {
    const blocks = deleteAccountBlocks(demoContexts(DEMO_USERS.maya));
    expect(blocks.some((b) => b.code === "sole_owner_with_members" && b.householdName === "UCSB Apartment")).toBe(true);
  });

  it("blocks a roommate who is not settled", () => {
    const blocks = deleteAccountBlocks(demoContexts(DEMO_USERS.chris));
    expect(blocks.some((b) => b.code === "outstanding_balance")).toBe(true);
  });
});

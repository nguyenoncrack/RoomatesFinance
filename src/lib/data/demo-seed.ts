import { format, subDays, subMonths, startOfMonth, addDays } from "date-fns";
import { computeSplit } from "@/lib/domain/splits";
import type { Category, Expense, Household, Member, Settlement, SplitMethod } from "@/lib/domain/types";

export interface DemoInvitation {
  id: string;
  householdId: string;
  tokenHash: string;
  expiresAt: string;
  maxUses: number;
  useCount: number;
  revokedAt: string | null;
  createdBy: string;
}

export interface DemoAuditEvent {
  id: string;
  householdId: string;
  actorId: string;
  entityType: "expense" | "settlement" | "member" | "household";
  entityId: string;
  action: string;
  summary: Record<string, unknown>;
  createdAt: string;
}

export interface DemoExpense extends Expense {
  clientRequestId: string | null;
  deletedAt: string | null;
  deletedBy: string | null;
}

export interface DemoSettlement extends Settlement {
  clientRequestId: string | null;
}

export interface DemoState {
  version: 1;
  currentUserId: string;
  profiles: { id: string; displayName: string; avatarUrl: string | null }[];
  households: Household[];
  members: (Omit<Member, "displayName" | "avatarUrl"> & { householdId: string })[];
  expenses: DemoExpense[];
  settlements: DemoSettlement[];
  invitations: DemoInvitation[];
  audit: DemoAuditEvent[];
}

export const DEMO_USERS = {
  alex: "u-alex",
  ben: "u-ben",
  chris: "u-chris",
  maya: "u-maya",
  jordan: "u-jordan",
} as const;

const H_APT = "h-ucsb-apartment";
const H_TRIP = "h-tahoe-trip";

/** Builds a fresh demo household with dates relative to `now` so "this month" always has data. */
export function createDemoState(now = new Date()): DemoState {
  const { alex, ben, chris, maya, jordan } = DEMO_USERS;
  const iso = (d: Date) => d.toISOString();
  const day = (d: Date) => format(d, "yyyy-MM-dd");
  const created = iso(subMonths(now, 6));

  const expenses: DemoExpense[] = [];
  let n = 0;
  const add = (
    householdId: string,
    title: string,
    amountCents: number,
    paidBy: string,
    category: Category,
    date: Date,
    participants: string[],
    method: SplitMethod = "equal",
    values?: Record<string, number>,
    description: string | null = null,
  ) => {
    const r = computeSplit({ method, totalCents: amountCents, participants, values });
    if (!r.ok) throw new Error(`Bad seed expense ${title}: ${r.error}`);
    const ts = iso(date);
    expenses.push({
      id: `e-seed-${++n}`,
      householdId,
      title,
      amountCents,
      paidBy,
      category,
      description,
      expenseDate: day(date),
      splitMethod: method,
      splits: r.splits,
      receiptUrl: null,
      createdBy: paidBy,
      createdAt: ts,
      updatedAt: ts,
      clientRequestId: null,
      deletedAt: null,
      deletedBy: null,
    });
  };

  const apt = [alex, ben, chris, maya];
  // Five previous months of recurring bills, all squared up by monthly settlements below.
  for (let m = 5; m >= 1; m--) {
    const month = startOfMonth(subMonths(now, m));
    add(H_APT, "Rent", 340000, maya, "rent", addDays(month, 0), apt, "shares", { [alex]: 1, [ben]: 1, [chris]: 1, [maya]: 1 }, "Paid to Isla Vista Properties");
    add(H_APT, "SoCal Edison", 9800 + m * 731, ben, "utilities", addDays(month, 11), apt);
    add(H_APT, "Cox Internet", 7499, alex, "internet", addDays(month, 3), apt);
    add(H_APT, "Trader Joe's run", 8000 + m * 1337, [alex, chris, ben, maya][m % 4], "groceries", addDays(month, 8), apt);
    add(H_APT, "Costco haul", 15000 + m * 911, [chris, alex, maya, ben][m % 4], "household_supplies", addDays(month, 19), apt);
  }

  // This month — the live, unsettled part of the ledger. Mirrors the spec's example.
  const thisMonth = startOfMonth(now);
  const recent = (offset: number) => {
    const d = subDays(now, offset);
    return d < thisMonth ? thisMonth : d;
  };
  add(H_APT, "Rent", 340000, maya, "rent", thisMonth, apt, "percentage", { [alex]: 2500, [ben]: 2500, [chris]: 2500, [maya]: 2500 }, "Paid to Isla Vista Properties");
  add(H_APT, "Groceries at Ralphs", 12000, alex, "groceries", recent(6), [alex, ben, chris]);
  add(H_APT, "Electricity bill", 9000, ben, "utilities", recent(5), [alex, ben, chris]);
  add(H_APT, "Cox Internet", 7499, alex, "internet", recent(4), apt);
  add(H_APT, "Freebirds burritos", 5640, chris, "food", recent(3), [alex, chris, maya], "custom", { [alex]: 1890, [chris]: 2010, [maya]: 1740 });
  add(H_APT, "Paper towels & dish soap", 2387, maya, "household_supplies", recent(2), apt);
  add(H_APT, "Costco haul", 18450, alex, "groceries", recent(1), apt, "shares", { [alex]: 2, [ben]: 1, [chris]: 1, [maya]: 1 }, "Alex is meal-prepping for two this month");

  const trip = [alex, ben, jordan];
  add(H_TRIP, "Cabin rental (2 nights)", 64000, jordan, "rent", subDays(now, 20), trip);
  add(H_TRIP, "Gas + chains", 9150, ben, "other", subDays(now, 19), trip);
  add(H_TRIP, "Lift tickets", 47700, alex, "other", subDays(now, 18), trip, "custom", { [alex]: 15900, [ben]: 15900, [jordan]: 15900 });

  const settlements: DemoSettlement[] = [];
  let s = 0;
  const settle = (householdId: string, paidBy: string, paidTo: string, amountCents: number, method: Settlement["paymentMethod"], date: Date, status: Settlement["status"] = "completed", note: string | null = null) => {
    settlements.push({
      id: `s-seed-${++s}`,
      householdId,
      paidBy,
      paidTo,
      amountCents,
      paymentMethod: method,
      status,
      note,
      createdBy: paidBy,
      createdAt: iso(date),
      completedAt: status === "completed" ? iso(date) : null,
      clientRequestId: null,
    });
  };

  // Square up all previous months exactly so only this month's activity is outstanding.
  const historic = expenses.filter((e) => e.householdId === H_APT && e.expenseDate < day(thisMonth));
  const net = new Map<string, number>(apt.map((id) => [id, 0]));
  for (const e of historic) {
    net.set(e.paidBy, net.get(e.paidBy)! + e.amountCents);
    for (const sp of e.splits) net.set(sp.userId, net.get(sp.userId)! - sp.shareCents);
  }
  const debtors = [...net].filter(([, v]) => v < 0).sort((a, b) => a[1] - b[1]);
  const creditors = [...net].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  let di = 0;
  let ci = 0;
  const methods: Settlement["paymentMethod"][] = ["venmo", "zelle", "venmo", "cash"];
  while (di < debtors.length && ci < creditors.length) {
    const amt = Math.min(-debtors[di][1], creditors[ci][1]);
    settle(H_APT, debtors[di][0], creditors[ci][0], amt, methods[(di + ci) % methods.length], subDays(thisMonth, 2 + di), "completed", "Monthly square-up");
    debtors[di][1] += amt;
    creditors[ci][1] -= amt;
    if (debtors[di][1] === 0) di++;
    if (creditors[ci][1] === 0) ci++;
  }

  settle(H_APT, ben, maya, 50000, "zelle", recent(2), "completed", "Part of this month's rent");
  settle(H_APT, chris, maya, 85000, "venmo", recent(0), "pending", "Rent — sending tonight");
  settle(H_TRIP, ben, jordan, 20000, "venmo", subDays(now, 15));

  const profiles = [
    { id: alex, displayName: "Alex Rivera", avatarUrl: null },
    { id: ben, displayName: "Ben Okafor", avatarUrl: null },
    { id: chris, displayName: "Chris Tanaka", avatarUrl: null },
    { id: maya, displayName: "Maya Patel", avatarUrl: null },
    { id: jordan, displayName: "Jordan Lee", avatarUrl: null },
  ];

  return {
    version: 1,
    currentUserId: alex,
    profiles,
    households: [
      { id: H_APT, name: "UCSB Apartment", createdBy: maya, createdAt: created },
      { id: H_TRIP, name: "Tahoe Ski Trip", createdBy: jordan, createdAt: iso(subDays(now, 25)) },
    ],
    members: [
      ...apt.map((userId) => ({
        householdId: H_APT,
        id: userId,
        role: (userId === maya ? "owner" : "member") as Member["role"],
        joinedAt: created,
        leftAt: null,
      })),
      ...trip.map((userId) => ({
        householdId: H_TRIP,
        id: userId,
        role: (userId === jordan ? "owner" : "member") as Member["role"],
        joinedAt: iso(subDays(now, 25)),
        leftAt: null,
      })),
    ],
    expenses,
    settlements,
    invitations: [],
    audit: [],
  };
}

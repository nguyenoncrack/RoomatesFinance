import { describe, expect, it } from "vitest";
import {
  MAX_CATCH_UP,
  currentSettleDay,
  describeSchedule,
  dueOccurrences,
  nextOccurrence,
  nextSettleDay,
  settleReminder,
} from "../recurring";

describe("nextOccurrence", () => {
  it("adds a week for weekly repeats", () => {
    expect(nextOccurrence("2026-10-14", "weekly")).toBe("2026-10-21");
    expect(nextOccurrence("2026-12-29", "weekly")).toBe("2027-01-05");
  });

  it("keeps the day of month for monthly repeats", () => {
    expect(nextOccurrence("2026-10-14", "monthly")).toBe("2026-11-14");
    expect(nextOccurrence("2026-12-01", "monthly")).toBe("2027-01-01");
  });

  it("clamps to short months and returns to the anchor day", () => {
    expect(nextOccurrence("2027-01-31", "monthly")).toBe("2027-02-28");
    expect(nextOccurrence("2027-02-28", "monthly", 31)).toBe("2027-03-31");
    expect(nextOccurrence("2028-01-30", "monthly")).toBe("2028-02-29");
  });
});

describe("dueOccurrences", () => {
  it("returns nothing when the next date is in the future", () => {
    expect(dueOccurrences("2026-10-20", "2026-10-14", "weekly", 20)).toEqual({ dates: [], nextDate: "2026-10-20" });
  });

  it("includes today and every missed occurrence", () => {
    expect(dueOccurrences("2026-09-30", "2026-10-14", "weekly", 30)).toEqual({
      dates: ["2026-09-30", "2026-10-07", "2026-10-14"],
      nextDate: "2026-10-21",
    });
  });

  it("caps catch-up and still lands the next date in the future", () => {
    const { dates, nextDate } = dueOccurrences("2020-01-01", "2026-10-14", "weekly", 1);
    expect(dates).toHaveLength(MAX_CATCH_UP);
    expect(nextDate > "2026-10-14").toBe(true);
  });
});

describe("settle day", () => {
  it("finds the current weekly period start", () => {
    // 2026-10-14 is a Wednesday (3).
    expect(currentSettleDay("2026-10-14", { cadence: "weekly", day: 3 })).toBe("2026-10-14");
    expect(currentSettleDay("2026-10-14", { cadence: "weekly", day: 0 })).toBe("2026-10-11");
    expect(currentSettleDay("2026-10-14", { cadence: "weekly", day: 5 })).toBe("2026-10-09");
  });

  it("finds the current monthly period start, across a year boundary", () => {
    expect(currentSettleDay("2026-10-14", { cadence: "monthly", day: 1 })).toBe("2026-10-01");
    expect(currentSettleDay("2026-10-14", { cadence: "monthly", day: 20 })).toBe("2026-09-20");
    expect(currentSettleDay("2027-01-05", { cadence: "monthly", day: 15 })).toBe("2026-12-15");
  });

  it("computes the next settle day", () => {
    expect(nextSettleDay("2026-10-14", { cadence: "weekly", day: 3 })).toBe("2026-10-21");
    expect(nextSettleDay("2026-10-14", { cadence: "monthly", day: 1 })).toBe("2026-11-01");
  });

  it("only reminds when money is outstanding and the period wasn't dismissed", () => {
    const schedule = { cadence: "monthly" as const, day: 1 };
    expect(settleReminder("2026-10-14", null, 500, null).due).toBe(false);
    expect(settleReminder("2026-10-14", schedule, 0, null).due).toBe(false);
    expect(settleReminder("2026-10-14", schedule, -500, null)).toEqual({ due: true, period: "2026-10-01" });
    expect(settleReminder("2026-10-14", schedule, 500, "2026-10-01").due).toBe(false);
    expect(settleReminder("2026-11-02", schedule, 500, "2026-10-01").due).toBe(true);
  });

  it("describes schedules", () => {
    expect(describeSchedule({ cadence: "weekly", day: 0 })).toBe("Every Sunday");
    expect(describeSchedule({ cadence: "monthly", day: 22 })).toBe("The 22nd of each month");
  });
});

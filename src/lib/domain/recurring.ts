/**
 * Calendar math for repeating expenses and the household settle day. Dates are plain
 * YYYY-MM-DD strings (local calendar days), never timestamps, so time zones can't shift them.
 */

export type Cadence = "weekly" | "monthly";
export const CADENCES: readonly Cadence[] = ["weekly", "monthly"];

/** How many missed occurrences a single catch-up run will create, so a long-paused template can't flood the ledger. */
export const MAX_CATCH_UP = 12;

function parseDay(day: string): { y: number; m: number; d: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) throw new Error(`Invalid day: ${day}`);
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

function formatDay(y: number, m: number, d: number): string {
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function addDays(day: string, n: number): string {
  const { y, m, d } = parseDay(day);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return formatDay(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

/** 0 = Sunday … 6 = Saturday. */
export function weekday(day: string): number {
  const { y, m, d } = parseDay(day);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function anchorDayOf(day: string): number {
  return parseDay(day).d;
}

/**
 * The occurrence after `day`. Monthly repeats keep their original day of the month (`anchorDay`)
 * and clamp to shorter months: an expense on the 31st lands on Feb 28/29, then back on Mar 31.
 */
export function nextOccurrence(day: string, cadence: Cadence, anchorDay = anchorDayOf(day)): string {
  if (cadence === "weekly") return addDays(day, 7);
  const { y, m } = parseDay(day);
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  return formatDay(ny, nm, Math.min(anchorDay, daysInMonth(ny, nm)));
}

/**
 * Every occurrence from `nextDate` up to and including `today`, capped at `MAX_CATCH_UP`,
 * plus the date the template should wait for afterwards.
 */
export function dueOccurrences(
  nextDate: string,
  today: string,
  cadence: Cadence,
  anchorDay: number,
): { dates: string[]; nextDate: string } {
  const dates: string[] = [];
  let cursor = nextDate;
  while (cursor <= today && dates.length < MAX_CATCH_UP) {
    dates.push(cursor);
    cursor = nextOccurrence(cursor, cadence, anchorDay);
  }
  // If the cap stopped us early, skip ahead so the template doesn't stay permanently behind.
  while (cursor <= today) cursor = nextOccurrence(cursor, cadence, anchorDay);
  return { dates, nextDate: cursor };
}

/** Optional household rhythm for settling up. Weekly uses a weekday (0–6), monthly a day 1–28. */
export interface SettleSchedule {
  cadence: Cadence;
  day: number;
}

export function isValidSettleSchedule(s: SettleSchedule): boolean {
  if (!Number.isInteger(s.day)) return false;
  return s.cadence === "weekly" ? s.day >= 0 && s.day <= 6 : s.day >= 1 && s.day <= 28;
}

/** The most recent settle day on or before `today`. It names the current settle period. */
export function currentSettleDay(today: string, schedule: SettleSchedule): string {
  if (schedule.cadence === "weekly") {
    const back = (weekday(today) - schedule.day + 7) % 7;
    return addDays(today, -back);
  }
  const { y, m, d } = parseDay(today);
  if (d >= schedule.day) return formatDay(y, m, schedule.day);
  const py = m === 1 ? y - 1 : y;
  const pm = m === 1 ? 12 : m - 1;
  return formatDay(py, pm, schedule.day);
}

/** The next settle day strictly after `today`, for "next settle day" labels. */
export function nextSettleDay(today: string, schedule: SettleSchedule): string {
  const current = currentSettleDay(today, schedule);
  if (schedule.cadence === "weekly") return addDays(current, 7);
  return nextOccurrence(current, "monthly", schedule.day);
}

/**
 * A reminder is due when the household has a settle day, the current period has started, and the
 * person still has money outstanding. Dismissals are per period, so it comes back next period.
 */
export function settleReminder(
  today: string,
  schedule: SettleSchedule | null,
  outstandingCents: number,
  dismissedPeriod: string | null,
): { due: boolean; period: string | null } {
  if (!schedule || !isValidSettleSchedule(schedule)) return { due: false, period: null };
  const period = currentSettleDay(today, schedule);
  return { due: outstandingCents !== 0 && dismissedPeriod !== period, period };
}

export const WEEKDAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

export function ordinal(n: number): string {
  const s = n % 100 >= 11 && n % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th";
  return `${n}${s}`;
}

export function describeSchedule(s: SettleSchedule): string {
  return s.cadence === "weekly" ? `Every ${WEEKDAY_LABELS[s.day]}` : `The ${ordinal(s.day)} of each month`;
}

import { format, formatDistanceToNowStrict, isThisYear, isToday, isYesterday, parseISO } from "date-fns";

/** Expense dates are calendar days (YYYY-MM-DD); parse them as local dates, not UTC. */
export function parseDay(day: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function formatDay(day: string): string {
  const date = parseDay(day);
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, isThisYear(date) ? "EEE, MMM d" : "MMM d, yyyy");
}

export function formatTimestamp(iso: string): string {
  const date = parseISO(iso);
  return format(date, isThisYear(date) ? "MMM d 'at' h:mm a" : "MMM d, yyyy 'at' h:mm a");
}

export function relativeTime(iso: string): string {
  return `${formatDistanceToNowStrict(parseISO(iso))} ago`;
}

export function todayDay(): string {
  return format(new Date(), "yyyy-MM-dd");
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

/** First names, except roommates who share a first name get their full name so "Alex → Alex" never happens. */
export function shortNames(members: { id: string; displayName: string }[]): Map<string, string> {
  const counts = new Map<string, number>();
  for (const m of members) {
    const key = firstName(m.displayName).toLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return new Map(
    members.map((m) => [m.id, (counts.get(firstName(m.displayName).toLowerCase()) ?? 0) > 1 ? m.displayName.trim() : firstName(m.displayName)]),
  );
}

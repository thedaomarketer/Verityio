import { fmt, type Locale } from "@/lib/i18n/config";
import type { Messages } from "@/lib/i18n/messages/en";

/** "3h 42m" in English, "3 h 42 min" in French/Spanish (their standard abbreviations). */
export function formatMinutesAsHours(minutes: number, locale: Locale): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  const [hourUnit, minuteUnit, sep] = locale === "en" ? ["h", "m", ""] : ["h", "min", " "];
  if (h === 0) return `${m}${sep}${minuteUnit}`;
  if (m === 0) return `${h}${sep}${hourUnit}`;
  return `${h}${sep}${hourUnit} ${m}${sep}${minuteUnit}`;
}

export function formatHms(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

/*
 * Every date/time formatter takes the user's time zone explicitly: the server
 * renders in UTC, so leaving it out shows UTC wall-clock times (and, near
 * midnight, the wrong day).
 */

export function formatTime(iso: string | Date, timezone: string, intl: string): string {
  return new Date(iso).toLocaleTimeString(intl, { hour: "numeric", minute: "2-digit", timeZone: timezone });
}

export function formatDate(iso: string | Date, timezone: string, intl: string): string {
  return new Date(iso).toLocaleDateString(intl, { weekday: "short", month: "short", day: "numeric", timeZone: timezone });
}

export function formatDateTime(iso: string | Date, timezone: string, intl: string): string {
  return `${formatDate(iso, timezone, intl)}, ${formatTime(iso, timezone, intl)}`;
}

/** "Jun 10" / "10 juin" -- short day + month, for chart axes and date ranges. */
export function formatShortDate(iso: string | Date, timezone: string, intl: string): string {
  return new Date(iso).toLocaleDateString(intl, { month: "short", day: "numeric", timeZone: timezone });
}

/** "Friday, Jun 14" -- for paydays. */
export function formatLongDate(iso: string | Date, timezone: string, intl: string): string {
  return new Date(iso).toLocaleDateString(intl, { weekday: "long", month: "short", day: "numeric", timeZone: timezone });
}

/**
 * A calendar date stored without a time zone (Postgres `date`, "yyyy-mm-dd").
 * Formatted as that literal date -- never shifted through any time zone.
 */
export function formatCalendarDate(date: string, intl: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(intl, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Whole days from now until `date` (0 or less means today). */
export function daysUntil(date: Date, now: Date = new Date()): number {
  return Math.ceil((date.getTime() - now.getTime()) / 86_400_000);
}

/** "Today" / "Tomorrow" / "In 3 days", for payday countdowns. */
export function formatDaysAway(days: number, m: Messages): string {
  if (days <= 0) return m.common.today;
  if (days === 1) return m.common.tomorrow;
  return fmt(m.common.inDays, { n: days });
}

/** Label for a report bucket: "Oct 5" (day or week start), "Oct 2026" (month), "2026" (year). */
export function formatBucketLabel(
  bucket: { start: Date; startDate: string },
  granularity: "day" | "week" | "month" | "year",
  timezone: string,
  intl: string
): string {
  if (granularity === "year") return bucket.startDate.slice(0, 4);
  if (granularity === "month") {
    return bucket.start.toLocaleDateString(intl, { month: "short", year: "numeric", timeZone: timezone });
  }
  return formatShortDate(bucket.start, timezone, intl);
}

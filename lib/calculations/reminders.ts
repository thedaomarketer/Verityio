import { formatInTimeZone } from "date-fns-tz";

import { localDateString } from "./local-time";

/**
 * Which push reminders are due for one user right now. Pure and
 * deterministic: the scheduler (lib/push/reminders.ts) runs it every 15
 * minutes, and `dedupeKey` -- recorded in notification_deliveries -- makes
 * each reminder fire at most once however often it runs.
 */

/** A shift still open after this long has probably been forgotten. */
export const LONG_SHIFT_MINUTES = 12 * 60;
/** A break still open after this long has probably been forgotten. */
export const LONG_BREAK_MINUTES = 60;
/** Payday reminders wait until this local hour, so nobody is woken at midnight. */
export const PAYDAY_REMINDER_HOUR = 8;

export interface ReminderInput {
  now: Date;
  timezone: string;
  activeShift: { id: string; startedAt: string; jobName: string } | null;
  openBreak: { id: string; startedAt: string } | null;
  paydays: { jobId: string; jobName: string; nextPayday: Date }[];
  /** Holiday names by yyyy-mm-dd, for the user's region. */
  holidayNames: Map<string, string>;
}

export type DueReminder =
  | { kind: "long_shift"; dedupeKey: string; jobName: string; minutes: number }
  | { kind: "long_break"; dedupeKey: string; minutes: number }
  | { kind: "payday"; dedupeKey: string; jobName: string; holidayName: string | null };

function minutesSince(iso: string, now: Date): number {
  return Math.floor((now.getTime() - new Date(iso).getTime()) / 60_000);
}

export function dueReminders(input: ReminderInput): DueReminder[] {
  const { now, timezone } = input;
  const due: DueReminder[] = [];

  if (input.activeShift) {
    const minutes = minutesSince(input.activeShift.startedAt, now);
    if (minutes >= LONG_SHIFT_MINUTES) {
      due.push({
        kind: "long_shift",
        dedupeKey: `long_shift:${input.activeShift.id}`,
        jobName: input.activeShift.jobName,
        minutes,
      });
    }
  }

  if (input.openBreak) {
    const minutes = minutesSince(input.openBreak.startedAt, now);
    if (minutes >= LONG_BREAK_MINUTES) {
      due.push({ kind: "long_break", dedupeKey: `long_break:${input.openBreak.id}`, minutes });
    }
  }

  const today = localDateString(now, timezone);
  const localHour = Number(formatInTimeZone(now, timezone, "H"));
  if (localHour >= PAYDAY_REMINDER_HOUR) {
    for (const payday of input.paydays) {
      if (localDateString(payday.nextPayday, timezone) !== today) continue;
      due.push({
        kind: "payday",
        dedupeKey: `payday:${payday.jobId}:${today}`,
        jobName: payday.jobName,
        holidayName: input.holidayNames.get(today) ?? null,
      });
    }
  }

  return due;
}

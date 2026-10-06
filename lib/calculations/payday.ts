import { fromZonedTime, toZonedTime } from "date-fns-tz";

export type PayFrequency = "weekly" | "biweekly" | "semi_monthly" | "monthly";

/**
 * Converts a value representing a *calendar date* (e.g. a Postgres `date`
 * column, which carries no time zone of its own) into the instant of local
 * midnight for that calendar date in `timezone`. A bare "YYYY-MM-DD" string
 * is parsed as calendar components directly -- never through `new
 * Date(string)`, which the JS spec parses as UTC midnight and would shift
 * the date backward by a day in any zone behind UTC. A `Date` (a true
 * instant) is first resolved to its calendar date in `timezone`.
 */
function localMidnight(value: Date | string, timezone: string): Date {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return fromZonedTime(new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0)), timezone);
  }

  const instant = value instanceof Date ? value : new Date(value);
  const zoned = toZonedTime(instant, timezone);
  const utcOfLocalCalendarDate = new Date(
    Date.UTC(zoned.getFullYear(), zoned.getMonth(), zoned.getDate(), 0, 0, 0, 0)
  );
  return fromZonedTime(utcOfLocalCalendarDate, timezone);
}

/** Local calendar-date components (in `timezone`) for an instant produced by `localMidnight`. */
function calendarParts(localMidnightInstant: Date, timezone: string): { year: number; month: number; day: number } {
  const zoned = toZonedTime(localMidnightInstant, timezone);
  return { year: zoned.getFullYear(), month: zoned.getMonth(), day: zoned.getDate() };
}

function addDays(localMidnightInstant: Date, days: number, timezone: string): Date {
  const { year, month, day } = calendarParts(localMidnightInstant, timezone);
  return fromZonedTime(new Date(Date.UTC(year, month, day + days, 0, 0, 0, 0)), timezone);
}

/**
 * The `cycles`-th monthly payday after `anchor`, clamped to the last day of
 * a shorter target month (e.g. an anchor on the 31st pays on Feb 29 in a
 * leap year) -- and always measured from the *original* anchor day-of-month,
 * never from a previously clamped date, so a short month doesn't
 * permanently drag every later payday off the anchor day.
 */
function monthlyPaydayForCycle(anchor: Date, timezone: string, cycles: number): Date {
  const { year, month, day } = calendarParts(anchor, timezone);
  const daysInTargetMonth = new Date(Date.UTC(year, month + cycles + 1, 0)).getUTCDate();
  const clampedDay = Math.min(day, daysInTargetMonth);
  return fromZonedTime(new Date(Date.UTC(year, month + cycles, clampedDay, 0, 0, 0, 0)), timezone);
}

/** The smallest cycle count (>= 0) whose monthly payday falls at or after `fromDay`. */
function monthlyCyclesUntil(anchor: Date, timezone: string, fromDay: Date): number {
  let cycles = 0;
  while (monthlyPaydayForCycle(anchor, timezone, cycles) < fromDay) {
    cycles += 1;
  }
  return cycles;
}

/** The two days-of-month a semi-monthly schedule pays on, ascending. */
function semiMonthlyPaydayDays(anchor: Date, timezone: string): [number, number] {
  const anchorDayOfMonth = calendarParts(anchor, timezone).day;
  const secondDayOfMonth = ((anchorDayOfMonth + 14 - 1) % 28) + 1;
  return [anchorDayOfMonth, secondDayOfMonth].sort((a, b) => a - b) as [number, number];
}

/**
 * Given a known past (or future) pay date and a frequency, returns the next
 * pay date at or after `from`. `anchorDate` is a calendar date (see
 * `localMidnight`); `from` is a true instant, defaulting to now.
 */
export function getNextPayday(
  anchorDate: Date | string,
  frequency: PayFrequency,
  timezone: string,
  from: Date = new Date()
): Date {
  const anchor = localMidnight(anchorDate, timezone);
  const fromDay = localMidnight(from, timezone);

  if (fromDay <= anchor) return anchor;

  if (frequency === "semi_monthly") {
    const paydays = semiMonthlyPaydayDays(anchor, timezone);

    let candidate = anchor;
    for (let i = 0; i < 62; i++) {
      if (candidate >= fromDay && paydays.includes(calendarParts(candidate, timezone).day)) {
        return candidate;
      }
      candidate = addDays(candidate, 1, timezone);
    }
    return candidate; // unreachable given the loop bound
  }

  if (frequency === "monthly") {
    return monthlyPaydayForCycle(anchor, timezone, monthlyCyclesUntil(anchor, timezone, fromDay));
  }

  const intervalDays = frequency === "weekly" ? 7 : 14;
  const daysSinceAnchor = Math.round((fromDay.getTime() - anchor.getTime()) / 86_400_000);
  const cyclesElapsed = Math.ceil(daysSinceAnchor / intervalDays);
  return addDays(anchor, cyclesElapsed * intervalDays, timezone);
}

/**
 * The pay period that ends on the next payday at or after `from` -- i.e.
 * "the period you're currently being paid for". `start` is exclusive of
 * the previous payday's own day (periods don't overlap); if the schedule's
 * anchor payday itself hasn't happened yet, there is no completed period
 * to report, so `start` equals `end` (an empty period, not a fabricated
 * guess at pre-anchor history).
 */
export function getPayPeriod(
  anchorDate: Date | string,
  frequency: PayFrequency,
  timezone: string,
  from: Date = new Date()
): { start: Date; end: Date } {
  const anchor = localMidnight(anchorDate, timezone);
  const end = getNextPayday(anchorDate, frequency, timezone, from);

  if (end.getTime() === anchor.getTime()) {
    return { start: anchor, end };
  }

  if (frequency === "weekly") return { start: addDays(end, -7, timezone), end };
  if (frequency === "biweekly") return { start: addDays(end, -14, timezone), end };
  if (frequency === "monthly") {
    const cycles = monthlyCyclesUntil(anchor, timezone, localMidnight(from, timezone));
    return { start: monthlyPaydayForCycle(anchor, timezone, cycles - 1), end };
  }

  // semi_monthly: the previous payday is the schedule's other day-of-month,
  // in this month if `end` is the later of the two, otherwise in the prior
  // month.
  const [d1, d2] = semiMonthlyPaydayDays(anchor, timezone);
  const { year, month, day } = calendarParts(end, timezone);
  const start =
    day === d2
      ? fromZonedTime(new Date(Date.UTC(year, month, d1, 0, 0, 0, 0)), timezone)
      : fromZonedTime(new Date(Date.UTC(year, month - 1, d2, 0, 0, 0, 0)), timezone);
  return { start, end };
}

/**
 * Days from a pay period's last day to its payday when the job doesn't say
 * otherwise: the period ends the day before payday.
 */
export const DEFAULT_PAY_LAG_DAYS = 1;

export interface PaidPeriod {
  /** Local midnight of the period's first day. */
  start: Date;
  /** Exclusive: local midnight after the period's last day. */
  end: Date;
  /** Local midnight of the day this period is paid. */
  payday: Date;
}

/**
 * Moves the period ending at a payday (`getPayPeriod`) back so its last day
 * is `lagDays` before payday -- e.g. a two-week period Sunday to Saturday,
 * paid the following Thursday, has a lag of 5. Exact for weekly and
 * biweekly pay; for semi-monthly and monthly the period keeps its length
 * and moves by the same number of days.
 */
function withLag(period: { start: Date; end: Date }, lagDays: number, timezone: string): PaidPeriod {
  const shift = DEFAULT_PAY_LAG_DAYS - lagDays;
  return { start: addDays(period.start, shift, timezone), end: addDays(period.end, shift, timezone), payday: period.end };
}

/**
 * The next paycheque at or after `from`: its payday and the period it pays
 * for. On payday itself, that's the paycheque arriving today.
 */
export function getNextPaycheque(
  anchorDate: Date | string,
  frequency: PayFrequency,
  timezone: string,
  lagDays: number = DEFAULT_PAY_LAG_DAYS,
  from: Date = new Date()
): PaidPeriod {
  return withLag(getPayPeriod(anchorDate, frequency, timezone, from), lagDays, timezone);
}

/**
 * The pay period being worked on `from` (the one containing that day) and
 * the payday it will be paid on. With a lag of more than a day this is a
 * later period than the next paycheque's.
 */
export function getCurrentPayPeriod(
  anchorDate: Date | string,
  frequency: PayFrequency,
  timezone: string,
  lagDays: number = DEFAULT_PAY_LAG_DAYS,
  from: Date = new Date()
): PaidPeriod {
  // The period containing `from` is paid on the first payday more than `lagDays - 1` days later.
  const payFrom = addDays(localMidnight(from, timezone), lagDays, timezone);
  return withLag(getPayPeriod(anchorDate, frequency, timezone, payFrom), lagDays, timezone);
}

/** Days between a known pay period's last day and its payday, from two calendar dates (YYYY-MM-DD). */
export function payLagDaysFrom(payday: string, periodLastDay: string): number {
  return Math.round((Date.parse(`${payday}T00:00:00Z`) - Date.parse(`${periodLastDay}T00:00:00Z`)) / 86_400_000);
}

/** Number of pay periods per year for a given frequency (average, for semi-monthly/monthly). */
export function payPeriodsPerYear(frequency: PayFrequency): number {
  switch (frequency) {
    case "weekly":
      return 52;
    case "biweekly":
      return 26;
    case "semi_monthly":
      return 24;
    case "monthly":
      return 12;
  }
}

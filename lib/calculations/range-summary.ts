import { calculateShiftDuration } from "./duration";
import { localDateString } from "./local-time";
import { earningsCentsForMinutes } from "./money";
import type { JobRateConfig, JobSummary, ShiftSummaryInput } from "./summary";
import { groupByWorkweek } from "./workweek";

function toTime(value: Date | string): number {
  return (value instanceof Date ? value : new Date(value)).getTime();
}

/** Minutes of [a0, a1) that fall inside [b0, b1). */
function overlap(a0: number, a1: number, b0: number, b1: number): number {
  return Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));
}

function positive(value: number | null | undefined): number | null {
  return value != null && value > 0 ? value : null;
}

export interface OvertimeRules {
  /** Weekly threshold in minutes, or null for none. */
  weeklyMinutes: number | null;
  /** Daily overtime threshold in minutes, or null for none. */
  dailyMinutes: number | null;
  /** Daily double-time threshold in minutes, or null for none. */
  doubleTimeMinutes: number | null;
}

export interface ShiftSplit {
  regular: number;
  overtime: number;
  doubleTime: number;
}

/**
 * Splits one shift's paid minutes into regular, overtime and double time,
 * given how much the same job already has earlier that day and how many
 * *regular* minutes it already has earlier that workweek.
 *
 * Daily tiers come first (minutes past the daily threshold are overtime,
 * past the double-time threshold are double time). Weekly overtime then
 * applies only to what's still regular -- hours already paid as daily
 * overtime don't count toward the weekly threshold a second time, the
 * California / British Columbia rule. With no daily thresholds this reduces
 * exactly to the plain weekly split.
 */
export function splitShiftMinutes(
  paidMinutes: number,
  dayMinutesBefore: number,
  weekRegularBefore: number,
  rules: OvertimeRules
): ShiftSplit {
  const dayStart = dayMinutesBefore;
  const dayEnd = dayMinutesBefore + paidMinutes;
  const doubleFrom = rules.doubleTimeMinutes ?? Infinity;
  const overtimeFrom = Math.min(rules.dailyMinutes ?? Infinity, doubleFrom);

  const doubleTime = overlap(dayStart, dayEnd, doubleFrom, Infinity);
  const dailyOvertime = overlap(dayStart, dayEnd, overtimeFrom, doubleFrom);
  const dailyRegular = paidMinutes - doubleTime - dailyOvertime;

  const weeklyOvertime =
    rules.weeklyMinutes === null
      ? 0
      : overlap(weekRegularBefore, weekRegularBefore + dailyRegular, rules.weeklyMinutes, Infinity);

  return { regular: dailyRegular - weeklyOvertime, overtime: dailyOvertime + weeklyOvertime, doubleTime };
}

/**
 * Per-job totals for any date range -- a pay period, a month, a custom
 * report range -- with overtime decided the only correct way: per workweek
 * (and per workday, for jobs with daily overtime).
 *
 * Shifts are grouped into workweeks in the user's time zone; within each,
 * each job's shifts are processed in chronological order, tracking that
 * job's paid minutes per workday (the local date a shift starts) and its
 * regular minutes so far that week, and each shift is split by
 * `splitShiftMinutes`. Only shifts that start inside [rangeStart, rangeEnd)
 * are counted, but earlier shifts in the same workweek still count toward
 * its thresholds -- so pass shifts from the start of the workweek containing
 * `rangeStart`.
 *
 * Earnings are computed per job in integer cents from its total minutes at
 * each rate: regular at the hourly rate, overtime at the overtime rate (or
 * the hourly rate when none is set), double time at the double-time rate
 * (or twice the hourly rate).
 */
export function summarizeRangeByJob(
  shifts: ShiftSummaryInput[],
  jobRates: Record<string, JobRateConfig>,
  timezone: string,
  weekStartsOn: number,
  rangeStart: Date,
  rangeEnd: Date
): Record<string, JobSummary> {
  const from = rangeStart.getTime();
  const to = rangeEnd.getTime();
  const result: Record<string, JobSummary> = {};

  for (const weekShifts of groupByWorkweek(shifts, timezone, weekStartsOn).values()) {
    const byJob = new Map<string, ShiftSummaryInput[]>();
    for (const shift of weekShifts) byJob.set(shift.jobId, [...(byJob.get(shift.jobId) ?? []), shift]);

    for (const [jobId, jobShifts] of byJob) {
      const rate = jobRates[jobId] ?? { hourlyRateCents: 0, overtimeRateCents: null, overtimeThresholdMinutes: null };
      const rules: OvertimeRules = {
        weeklyMinutes: positive(rate.overtimeThresholdMinutes),
        dailyMinutes: positive(rate.dailyOvertimeThresholdMinutes),
        doubleTimeMinutes: positive(rate.doubleTimeThresholdMinutes),
      };

      const dayMinutes = new Map<string, number>();
      let weekRegular = 0;
      let regular = 0;
      let overtime = 0;
      let doubleTime = 0;
      let count = 0;

      for (const shift of [...jobShifts].sort((a, b) => toTime(a.start) - toTime(b.start))) {
        const { paidMinutes, isComplete } = calculateShiftDuration(shift);
        if (!isComplete) continue;

        const day = localDateString(shift.start, timezone);
        const split = splitShiftMinutes(paidMinutes, dayMinutes.get(day) ?? 0, weekRegular, rules);
        dayMinutes.set(day, (dayMinutes.get(day) ?? 0) + paidMinutes);
        weekRegular += split.regular;

        const start = toTime(shift.start);
        if (start < from || start >= to) continue;
        regular += split.regular;
        overtime += split.overtime;
        doubleTime += split.doubleTime;
        count += 1;
      }

      if (count === 0) continue;
      const total = (result[jobId] ??= {
        paidMinutes: 0,
        regularMinutes: 0,
        overtimeMinutes: 0,
        doubleTimeMinutes: 0,
        earningsCents: 0,
        shiftCount: 0,
      });
      total.paidMinutes += regular + overtime + doubleTime;
      total.regularMinutes += regular;
      total.overtimeMinutes += overtime + doubleTime;
      total.doubleTimeMinutes += doubleTime;
      total.shiftCount += count;
    }
  }

  // Pay is worked out once per job from its total minutes at each rate, the
  // way payroll does -- rounding every workweek separately could leave the
  // total a cent off (70 hours at $25 must be exactly $1,750.00).
  for (const [jobId, total] of Object.entries(result)) {
    const rate = jobRates[jobId] ?? { hourlyRateCents: 0, overtimeRateCents: null, overtimeThresholdMinutes: null };
    const overtimeOnly = total.overtimeMinutes - total.doubleTimeMinutes;
    total.earningsCents =
      earningsCentsForMinutes(total.regularMinutes, rate.hourlyRateCents) +
      earningsCentsForMinutes(overtimeOnly, rate.overtimeRateCents ?? rate.hourlyRateCents) +
      earningsCentsForMinutes(total.doubleTimeMinutes, rate.doubleTimeRateCents ?? rate.hourlyRateCents * 2);
  }

  return result;
}

/** Ready-made rule sets for the job form. Thresholds in minutes. */
export const OVERTIME_PRESETS = {
  weekly40: { weekly: 2400, daily: null, doubleTime: null },
  weekly44: { weekly: 2640, daily: null, doubleTime: null },
  california: { weekly: 2400, daily: 480, doubleTime: 720 },
  britishColumbia: { weekly: 2400, daily: 480, doubleTime: 720 },
  daily8: { weekly: 2400, daily: 480, doubleTime: null },
  colorado: { weekly: 2400, daily: 720, doubleTime: null },
} as const satisfies Record<string, { weekly: number; daily: number | null; doubleTime: number | null }>;

export type OvertimePreset = keyof typeof OVERTIME_PRESETS;

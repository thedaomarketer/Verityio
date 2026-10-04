import { calculateShiftDuration } from "./duration";
import { earningsCentsForMinutes } from "./money";
import type { JobRateConfig, JobSummary, ShiftSummaryInput } from "./summary";
import { groupByWorkweek } from "./workweek";

function toTime(value: Date | string): number {
  return (value instanceof Date ? value : new Date(value)).getTime();
}

/**
 * Per-job totals for any date range -- a pay period, a month, a custom
 * report range -- with overtime decided the only correct way: per workweek.
 *
 * Overtime thresholds are weekly (e.g. 40h/week), so summing a two-week pay
 * period first and applying the threshold once would call half of an
 * ordinary fortnight "overtime". Instead, shifts are grouped into workweeks
 * (in the user's time zone), each job's minutes are accumulated in
 * chronological order within its week, and a shift's minutes past the
 * threshold are overtime. Only shifts that start inside
 * [rangeStart, rangeEnd) are counted, but earlier shifts in the same
 * workweek still count toward its threshold -- so pass shifts from the
 * start of the workweek containing `rangeStart` (see `workweekContextStart`).
 *
 * Earnings are computed per (workweek, job) in integer cents, matching the
 * weekly trend charts exactly.
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
      const threshold = rate.overtimeThresholdMinutes && rate.overtimeThresholdMinutes > 0 ? rate.overtimeThresholdMinutes : null;

      let weekMinutesSoFar = 0;
      let regular = 0;
      let overtime = 0;
      let count = 0;

      for (const shift of [...jobShifts].sort((a, b) => toTime(a.start) - toTime(b.start))) {
        const { paidMinutes, isComplete } = calculateShiftDuration(shift);
        if (!isComplete) continue;

        const regularPart = threshold === null ? paidMinutes : Math.max(0, Math.min(paidMinutes, threshold - weekMinutesSoFar));
        weekMinutesSoFar += paidMinutes;

        const start = toTime(shift.start);
        if (start < from || start >= to) continue;
        regular += regularPart;
        overtime += paidMinutes - regularPart;
        count += 1;
      }

      if (count === 0) continue;
      const earnings =
        earningsCentsForMinutes(regular, rate.hourlyRateCents) +
        earningsCentsForMinutes(overtime, rate.overtimeRateCents ?? rate.hourlyRateCents);

      const total = (result[jobId] ??= { paidMinutes: 0, regularMinutes: 0, overtimeMinutes: 0, earningsCents: 0, shiftCount: 0 });
      total.paidMinutes += regular + overtime;
      total.regularMinutes += regular;
      total.overtimeMinutes += overtime;
      total.earningsCents += earnings;
      total.shiftCount += count;
    }
  }

  return result;
}

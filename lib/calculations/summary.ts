import { calculateShiftDuration } from "./duration";
import { calculateEarnings } from "./overtime";
import type { BreakInterval, DateLike, JobRate } from "./types";

export interface ShiftSummaryInput {
  jobId: string;
  start: DateLike;
  end: DateLike | null;
  breaks: BreakInterval[];
}

export interface JobRateConfig extends JobRate {
  /** Weekly threshold; null or 0 disables weekly overtime for this job. */
  overtimeThresholdMinutes: number | null;
  /** Paid minutes in one workday before daily overtime; null/0 = none. */
  dailyOvertimeThresholdMinutes?: number | null;
  /** Paid minutes in one workday before double time; null/0 = none. */
  doubleTimeThresholdMinutes?: number | null;
  /** Double-time hourly rate in cents; null = twice the hourly rate. */
  doubleTimeRateCents?: number | null;
}

export interface JobSummary {
  paidMinutes: number;
  regularMinutes: number;
  /** All premium time (overtime + double time). */
  overtimeMinutes: number;
  /** The part of `overtimeMinutes` paid at the double-time rate. */
  doubleTimeMinutes: number;
  earningsCents: number;
  shiftCount: number;
}

/**
 * Aggregates a set of shifts (already filtered to a single time range, e.g.
 * a workweek) into per-job totals, applying each job's own rate and
 * weekly overtime threshold to that job's total paid minutes for the range.
 *
 * Weekly-only and whole-range: prefer `summarizeRangeByJob`, which splits
 * overtime per workweek and applies daily overtime and double time. Kept
 * for the landing-page estimator's simple single-week math and its tests.
 */
export function summarizeShiftsByJob(
  shifts: ShiftSummaryInput[],
  jobRates: Record<string, JobRateConfig>
): Record<string, JobSummary> {
  const paidMinutesByJob = new Map<string, number>();
  const shiftCountByJob = new Map<string, number>();

  for (const shift of shifts) {
    const { paidMinutes, isComplete } = calculateShiftDuration(shift);
    if (!isComplete) continue;
    paidMinutesByJob.set(shift.jobId, (paidMinutesByJob.get(shift.jobId) ?? 0) + paidMinutes);
    shiftCountByJob.set(shift.jobId, (shiftCountByJob.get(shift.jobId) ?? 0) + 1);
  }

  const result: Record<string, JobSummary> = {};

  for (const [jobId, paidMinutes] of paidMinutesByJob) {
    const rate = jobRates[jobId] ?? { hourlyRateCents: 0, overtimeRateCents: null, overtimeThresholdMinutes: null };
    const earnings = calculateEarnings(paidMinutes, rate, {
      enabled: !!rate.overtimeThresholdMinutes,
      thresholdMinutes: rate.overtimeThresholdMinutes ?? 0,
    });

    result[jobId] = {
      paidMinutes,
      regularMinutes: earnings.regularMinutes,
      overtimeMinutes: earnings.overtimeMinutes,
      doubleTimeMinutes: 0,
      earningsCents: earnings.totalEarningsCents,
      shiftCount: shiftCountByJob.get(jobId) ?? 0,
    };
  }

  return result;
}

export function sumJobSummaries(summaries: Record<string, JobSummary>): {
  paidMinutes: number;
  regularMinutes: number;
  overtimeMinutes: number;
  doubleTimeMinutes: number;
  earningsCents: number;
} {
  let paidMinutes = 0;
  let regularMinutes = 0;
  let overtimeMinutes = 0;
  let doubleTimeMinutes = 0;
  let earningsCents = 0;

  for (const summary of Object.values(summaries)) {
    paidMinutes += summary.paidMinutes;
    regularMinutes += summary.regularMinutes;
    overtimeMinutes += summary.overtimeMinutes;
    doubleTimeMinutes += summary.doubleTimeMinutes;
    earningsCents += summary.earningsCents;
  }

  return { paidMinutes, regularMinutes, overtimeMinutes, doubleTimeMinutes, earningsCents };
}

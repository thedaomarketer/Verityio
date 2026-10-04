import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getCompletedShiftsInRange } from "./shifts";
import {
  getNextPayday,
  getPayPeriod,
  getWorkweekBounds,
  payPeriodsPerYear,
  summarizeRangeByJob,
  sumJobSummaries,
  type PayFrequency,
} from "@/lib/calculations";
import { jobRatesFrom, shiftInputsFrom } from "./earnings";

const INCOME_SAMPLE_WEEKS = 8;

export interface AnnualIncomeEstimate {
  /** Estimated annual gross income, derived from recent recorded shifts. */
  annualEstimateCents: number;
  /** Total earned across the sample window, before annualizing. */
  sampleEarningsCents: number;
  sampleWeeks: number;
  hasData: boolean;
}

/**
 * Estimates annual gross income by averaging earnings from recorded shifts
 * over the last `INCOME_SAMPLE_WEEKS` weeks and extrapolating to a year.
 * This is a starting point for the tax estimate, not a payroll figure --
 * the tax page lets the user override it.
 */
export async function getAnnualIncomeEstimate(
  userId: string,
  timezone: string,
  weekStartsOn: number
): Promise<AnnualIncomeEstimate> {
  const supabase = await createClient();

  const end = new Date();
  const start = new Date(end.getTime() - INCOME_SAMPLE_WEEKS * 7 * 86_400_000);
  // Earlier shifts in the first workweek still count toward its overtime threshold.
  const contextStart = getWorkweekBounds(start, timezone, weekStartsOn).start;

  const [shifts, { data: jobs }] = await Promise.all([
    getCompletedShiftsInRange(userId, contextStart, end),
    supabase.from("jobs").select("id, hourly_rate, overtime_rate, overtime_threshold_minutes").eq("user_id", userId),
  ]);

  const { earningsCents } = sumJobSummaries(
    summarizeRangeByJob(shiftInputsFrom(shifts), jobRatesFrom(jobs ?? []), timezone, weekStartsOn, start, end)
  );

  return {
    annualEstimateCents: Math.round((earningsCents / INCOME_SAMPLE_WEEKS) * 52),
    sampleEarningsCents: earningsCents,
    sampleWeeks: INCOME_SAMPLE_WEEKS,
    hasData: earningsCents > 0,
  };
}

export interface JobPayday {
  jobId: string;
  jobName: string;
  color: string;
  frequency: PayFrequency;
  nextPayday: Date;
}

/** Next projected payday for every active job with a pay schedule configured. */
export async function getUpcomingPaydays(userId: string, timezone: string): Promise<JobPayday[]> {
  const supabase = await createClient();
  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, name, color, pay_frequency, pay_anchor_date")
    .eq("user_id", userId)
    .eq("is_active", true)
    .not("pay_frequency", "is", null)
    .not("pay_anchor_date", "is", null);

  const paydays = (jobs ?? [])
    .filter((job) => job.pay_frequency && job.pay_anchor_date)
    .map((job) => ({
      jobId: job.id,
      jobName: job.name,
      color: job.color,
      frequency: job.pay_frequency as PayFrequency,
      nextPayday: getNextPayday(job.pay_anchor_date!, job.pay_frequency as PayFrequency, timezone),
    }));

  return paydays.sort((a, b) => a.nextPayday.getTime() - b.nextPayday.getTime());
}

export interface PayPeriodStatement {
  jobId: string;
  jobName: string;
  color: string;
  frequency: PayFrequency;
  periodsPerYear: number;
  periodStart: Date;
  periodEnd: Date;
  payDate: Date;
  paidMinutes: number;
  regularMinutes: number;
  overtimeMinutes: number;
  grossEarningsCents: number;
}

/**
 * A pay-stub-style statement for the current pay period of every active job
 * with a pay schedule configured -- hours and gross pay are always the
 * recorded/calculated figures from lib/calculations, never fabricated.
 */
export async function getPayPeriodStatements(
  userId: string,
  timezone: string,
  weekStartsOn: number
): Promise<PayPeriodStatement[]> {
  const supabase = await createClient();
  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, name, color, hourly_rate, overtime_rate, overtime_threshold_minutes, pay_frequency, pay_anchor_date")
    .eq("user_id", userId)
    .eq("is_active", true)
    .not("pay_frequency", "is", null)
    .not("pay_anchor_date", "is", null);

  const scheduledJobs = (jobs ?? []).filter((job) => job.pay_frequency && job.pay_anchor_date);
  // Measured from tomorrow, so on payday itself "current" is the period now
  // being worked (which includes today), not the one that was just paid.
  const tomorrow = new Date(Date.now() + 86_400_000);

  const statements = await Promise.all(
    scheduledJobs.map(async (job) => {
      const frequency = job.pay_frequency as PayFrequency;
      const { start, end } = getPayPeriod(job.pay_anchor_date!, frequency, timezone, tomorrow);

      // Overtime is weekly: fetch from the start of the workweek the period
      // begins in, so hours just before the period count toward its threshold.
      const contextStart = getWorkweekBounds(start, timezone, weekStartsOn).start;
      const shifts = start.getTime() === end.getTime() ? [] : await getCompletedShiftsInRange(userId, contextStart, end);
      const summary = summarizeRangeByJob(
        shiftInputsFrom(shifts.filter((s) => s.job_id === job.id)),
        jobRatesFrom([job]),
        timezone,
        weekStartsOn,
        start,
        end
      )[job.id] ?? { paidMinutes: 0, regularMinutes: 0, overtimeMinutes: 0, earningsCents: 0, shiftCount: 0 };

      return {
        jobId: job.id,
        jobName: job.name,
        color: job.color,
        frequency,
        periodsPerYear: payPeriodsPerYear(frequency),
        periodStart: start,
        periodEnd: end,
        payDate: end,
        paidMinutes: summary.paidMinutes,
        regularMinutes: summary.regularMinutes,
        overtimeMinutes: summary.overtimeMinutes,
        grossEarningsCents: summary.earningsCents,
      };
    })
  );

  return statements.sort((a, b) => a.payDate.getTime() - b.payDate.getTime());
}

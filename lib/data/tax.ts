import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getCompletedShiftsInRange } from "./shifts";
import {
  DEFAULT_PAY_LAG_DAYS,
  getCurrentPayPeriod,
  getNextPaycheque,
  getNextPayday,
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
    supabase.from("jobs").select("id, hourly_rate, overtime_rate, overtime_threshold_minutes, daily_overtime_threshold_minutes, double_time_threshold_minutes, double_time_rate").eq("user_id", userId),
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

export interface PeriodFigures {
  /** Local midnight of the period's first day. */
  start: Date;
  /** Exclusive: local midnight after the period's last day. */
  end: Date;
  payDate: Date;
  paidMinutes: number;
  regularMinutes: number;
  overtimeMinutes: number;
  /** The part of overtimeMinutes paid at the double-time rate. */
  doubleTimeMinutes: number;
  grossEarningsCents: number;
}

export interface PayPeriodStatement {
  jobId: string;
  jobName: string;
  color: string;
  frequency: PayFrequency;
  periodsPerYear: number;
  /** The next paycheque (today's, on payday) and the period it pays for. */
  paycheque: PeriodFigures;
  /** The period being worked now, when it isn't the one the next paycheque covers. */
  current: PeriodFigures | null;
}

/**
 * Pay-stub-style figures for every active job with a pay schedule: the next
 * paycheque and, when the employer pays a few days after a period closes,
 * the period being worked now. Hours and gross pay are always the
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
    .select("id, name, color, hourly_rate, overtime_rate, overtime_threshold_minutes, daily_overtime_threshold_minutes, double_time_threshold_minutes, double_time_rate, pay_frequency, pay_anchor_date, pay_lag_days")
    .eq("user_id", userId)
    .eq("is_active", true)
    .not("pay_frequency", "is", null)
    .not("pay_anchor_date", "is", null);

  const scheduledJobs = (jobs ?? []).filter((job) => job.pay_frequency && job.pay_anchor_date);
  const now = new Date();

  const statements = await Promise.all(
    scheduledJobs.map(async (job) => {
      const frequency = job.pay_frequency as PayFrequency;
      const lag = job.pay_lag_days ?? DEFAULT_PAY_LAG_DAYS;
      const next = getNextPaycheque(job.pay_anchor_date!, frequency, timezone, lag, now);
      const working = getCurrentPayPeriod(job.pay_anchor_date!, frequency, timezone, lag, now);
      const periods = working.start.getTime() === next.start.getTime() ? [next] : [next, working];

      // One fetch for both periods. Overtime is weekly: start at the workweek
      // the first period begins in, so hours just before it count toward its threshold.
      const contextStart = getWorkweekBounds(periods[0].start, timezone, weekStartsOn).start;
      const fetchEnd = periods[periods.length - 1].end;
      const hasRange = periods.some((period) => period.start.getTime() !== period.end.getTime());
      const shifts = hasRange ? await getCompletedShiftsInRange(userId, contextStart, fetchEnd) : [];
      const inputs = shiftInputsFrom(shifts.filter((s) => s.job_id === job.id));
      const rates = jobRatesFrom([job]);

      const figures = (period: { start: Date; end: Date; payday: Date }): PeriodFigures => {
        const summary = summarizeRangeByJob(inputs, rates, timezone, weekStartsOn, period.start, period.end)[job.id];
        return {
          start: period.start,
          end: period.end,
          payDate: period.payday,
          paidMinutes: summary?.paidMinutes ?? 0,
          regularMinutes: summary?.regularMinutes ?? 0,
          overtimeMinutes: summary?.overtimeMinutes ?? 0,
          doubleTimeMinutes: summary?.doubleTimeMinutes ?? 0,
          grossEarningsCents: summary?.earningsCents ?? 0,
        };
      };

      return {
        jobId: job.id,
        jobName: job.name,
        color: job.color,
        frequency,
        periodsPerYear: payPeriodsPerYear(frequency),
        paycheque: figures(next),
        current: periods.length > 1 ? figures(working) : null,
      };
    })
  );

  return statements.sort((a, b) => a.paycheque.payDate.getTime() - b.paycheque.payDate.getTime());
}

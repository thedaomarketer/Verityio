import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  addDaysToDateString,
  dollarsToCents,
  getWorkweekBounds,
  localDateString,
  localDayStart,
  periodBuckets,
  resolveReportRange,
  summarizeRangeByJob,
  sumJobSummaries,
  type Granularity,
} from "@/lib/calculations";
import type { UserContext } from "./context";
import { jobRatesFrom, shiftInputsFrom } from "./earnings";

export type ReportSearchParams = { range?: string; start?: string; end?: string; by?: string };

/**
 * Everything the Reports page and its breakdowns share, so the tile you tap
 * and the breakdown it opens can never disagree. Shifts are fetched from the
 * start of the workweek the range begins in (overtime is weekly), and every
 * total goes through `summarizeRangeByJob`.
 */
export async function getReportData(ctx: UserContext, params: ReportSearchParams, premium: boolean) {
  const now = new Date();
  const today = localDateString(now, ctx.timezone);
  const weekStart = localDateString(getWorkweekBounds(now, ctx.timezone, ctx.weekStartsOn).start, ctx.timezone);
  const range = resolveReportRange(params, { today, weekStart, premium });
  const rangeStart = localDayStart(range.start, ctx.timezone);
  const rangeEnd = localDayStart(addDaysToDateString(range.end, 1), ctx.timezone);
  const contextStart = getWorkweekBounds(rangeStart, ctx.timezone, ctx.weekStartsOn).start;

  const supabase = await createClient();
  const [{ data: jobs }, { data: shifts }, { data: expenses }, { data: mileage }] = await Promise.all([
    supabase.from("jobs").select("*").eq("user_id", ctx.userId),
    supabase
      .from("shifts")
      .select("*, breaks(*)")
      .eq("user_id", ctx.userId)
      .eq("status", "completed")
      .gte("actual_start", contextStart.toISOString())
      .lt("actual_start", rangeEnd.toISOString())
      .order("actual_start", { ascending: true }),
    supabase
      .from("expenses")
      .select("*")
      .eq("user_id", ctx.userId)
      .gte("expense_date", range.start)
      .lte("expense_date", range.end)
      .order("expense_date", { ascending: true }),
    supabase
      .from("mileage_entries")
      .select("*")
      .eq("user_id", ctx.userId)
      .gte("date", range.start)
      .lte("date", range.end)
      .order("date", { ascending: true }),
  ]);

  const jobRates = jobRatesFrom(jobs ?? []);
  const allShiftInputs = shiftInputsFrom(shifts ?? []);
  const summarize = (start: Date, end: Date) =>
    summarizeRangeByJob(allShiftInputs, jobRates, ctx.timezone, ctx.weekStartsOn, start, end);

  const summaries = summarize(rangeStart, rangeEnd);
  const inRangeShifts = (shifts ?? []).filter(
    (s) => s.actual_start && s.actual_start >= rangeStart.toISOString() && s.actual_start < rangeEnd.toISOString()
  );

  /** Totals per day / week / month / year across the range, with weekly overtime. */
  const bucketTotals = (granularity: Granularity) =>
    periodBuckets(range.start, range.end, granularity, ctx.timezone, ctx.weekStartsOn).map((bucket) => ({
      ...bucket,
      ...sumJobSummaries(summarize(bucket.start, bucket.end)),
    }));

  // Keeps the current range when moving between the page and its breakdowns.
  const rangeQuery = new URLSearchParams(
    range.preset === "custom" ? { start: range.start, end: range.end } : { range: range.preset }
  ).toString();

  return {
    range,
    rangeStart,
    rangeEnd,
    rangeQuery,
    jobs: jobs ?? [],
    jobsById: new Map((jobs ?? []).map((j) => [j.id, j])),
    inRangeShifts,
    summaries,
    totals: sumJobSummaries(summaries),
    bucketTotals,
    expenses: expenses ?? [],
    mileage: mileage ?? [],
    totalExpensesCents: (expenses ?? []).reduce((sum, e) => sum + dollarsToCents(e.amount), 0),
    totalMileageCents: (mileage ?? []).reduce((sum, t) => sum + dollarsToCents(t.reimbursement), 0),
  };
}

export type ReportData = Awaited<ReturnType<typeof getReportData>>;

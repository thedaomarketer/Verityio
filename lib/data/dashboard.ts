import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getShellProfile, requireUserContext } from "./context";
import { getActiveShift, getCompletedShiftsInRange, getUpcomingShifts } from "./shifts";
import { getUpcomingPaydays } from "./tax";
import { getHolidayRegion, getRegionHolidays } from "./holidays";
import { jobRatesFrom } from "./earnings";
import {
  getLocalDayBounds,
  getLocalMonthBounds,
  getWorkweekBounds,
  localDateString,
  summarizeRangeByJob,
  sumJobSummaries,
  upcomingHolidays,
} from "@/lib/calculations";

export async function getDashboardData() {
  const ctx = await requireUserContext();
  if (!ctx) return null;

  const supabase = await createClient();
  const now = new Date();

  const day = getLocalDayBounds(now, ctx.timezone);
  const week = getWorkweekBounds(now, ctx.timezone, ctx.weekStartsOn);
  const month = getLocalMonthBounds(now, ctx.timezone);

  const today = localDateString(now, ctx.timezone);
  // Everything in one parallel round: the holidays chain off the region lookup
  // inside the batch instead of holding up every other query.
  const [
    { data: overtimeSettings },
    profile,
    { data: jobs },
    activeShift,
    rangeShifts,
    upcomingShifts,
    { data: journalEntries },
    paydays,
    regionHolidays,
  ] = await Promise.all([
      supabase
        .from("user_settings")
        .select("overtime_enabled, overtime_threshold_minutes")
        .eq("user_id", ctx.userId)
        .maybeSingle(),
      // Already loaded by the app layout in this request (cached).
      getShellProfile(ctx.userId),
      supabase.from("jobs").select("*").eq("user_id", ctx.userId).eq("is_active", true),
      getActiveShift(ctx.userId),
      // One fetch covering both the month and the workweek -- a week can start in the previous month.
      // From the start of the workweek the month begins in, so that week's earlier days count toward overtime.
      getCompletedShiftsInRange(
        ctx.userId,
        getWorkweekBounds(month.start, ctx.timezone, ctx.weekStartsOn).start,
        week.end > month.end ? week.end : month.end
      ),
      getUpcomingShifts(ctx.userId, 5),
      supabase
        .from("journal_entries")
        .select("*, job:jobs(name, color)")
        .eq("user_id", ctx.userId)
        .order("event_at", { ascending: false })
        .limit(5),
      getUpcomingPaydays(ctx.userId, ctx.timezone),
      // This year and next, so a window crossing New Year still works.
      getHolidayRegion(supabase, ctx.userId).then((holidayRegion) =>
        holidayRegion ? getRegionHolidays(holidayRegion, [Number(today.slice(0, 4)), Number(today.slice(0, 4)) + 1]) : []
      ),
    ]);

  const jobRates = jobRatesFrom(jobs ?? []);

  const within = (bounds: { start: Date; end: Date }) =>
    rangeShifts.filter(
      (s) => s.actual_start && s.actual_start >= bounds.start.toISOString() && s.actual_start < bounds.end.toISOString()
    );
  const monthShifts = within(month);

  const toShiftInput = (shifts: typeof rangeShifts) =>
    shifts
      .filter((s) => s.actual_start)
      .map((s) => ({
        jobId: s.job_id,
        start: s.actual_start!,
        end: s.actual_end,
        breaks: s.breaks.map((b) => ({ startedAt: b.started_at, endedAt: b.ended_at, isPaid: b.is_paid })),
      }));


  // Overtime is weekly, so today's and the month's totals are split per
  // workweek with the earlier days of each week counted (the fetch covers the
  // whole current workweek).
  const allInputs = toShiftInput(rangeShifts);
  const todayTotals = sumJobSummaries(summarizeRangeByJob(allInputs, jobRates, ctx.timezone, ctx.weekStartsOn, day.start, day.end));
  const weekTotals = sumJobSummaries(summarizeRangeByJob(allInputs, jobRates, ctx.timezone, ctx.weekStartsOn, week.start, week.end));
  const monthTotals = sumJobSummaries(summarizeRangeByJob(allInputs, jobRates, ctx.timezone, ctx.weekStartsOn, month.start, month.end));

  return {
    fullName: profile?.full_name ?? null,
    timezone: ctx.timezone,
    currency: ctx.currency,
    activeShift,
    jobs: jobs ?? [],
    todayTotals,
    weekTotals,
    monthTotals,
    upcomingShifts,
    journalEntries: journalEntries ?? [],
    recentCompletedShifts: monthShifts.filter((s) => s.status === "completed").slice(0, 5),
    nextPayday: paydays[0] ?? null,
    upcomingHolidays: upcomingHolidays(regionHolidays, today, 30).slice(0, 2),
    /** The default weekly overtime threshold (jobs may set their own). */
    overtimeThresholdMinutes:
      overtimeSettings?.overtime_enabled && overtimeSettings.overtime_threshold_minutes > 0
        ? overtimeSettings.overtime_threshold_minutes
        : null,
  };
}

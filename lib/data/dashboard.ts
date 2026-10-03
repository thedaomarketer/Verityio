import "server-only";

import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "./context";
import { getActiveShift, getCompletedShiftsInRange, getUpcomingShifts } from "./shifts";
import { getUpcomingPaydays } from "./tax";
import { getHolidayRegion, getRegionHolidays } from "./holidays";
import {
  dollarsToCents,
  getLocalDayBounds,
  getLocalMonthBounds,
  getWorkweekBounds,
  localDateString,
  summarizeShiftsByJob,
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
  const [holidayRegion, { data: overtimeSettings }] = await Promise.all([
    getHolidayRegion(supabase, ctx.userId),
    supabase
      .from("user_settings")
      .select("overtime_enabled, overtime_threshold_minutes")
      .eq("user_id", ctx.userId)
      .maybeSingle(),
  ]);

  const [
    { data: profile },
    { data: jobs },
    activeShift,
    monthShifts,
    upcomingShifts,
    { data: journalEntries },
    paydays,
    regionHolidays,
  ] = await Promise.all([
      supabase.from("profiles").select("full_name").eq("id", ctx.userId).maybeSingle(),
      supabase.from("jobs").select("*").eq("user_id", ctx.userId).eq("is_active", true),
      getActiveShift(ctx.userId),
      // Fetch the whole month once; today/week are subsets of it.
      getCompletedShiftsInRange(ctx.userId, month.start, month.end),
      getUpcomingShifts(ctx.userId, 5),
      supabase
        .from("journal_entries")
        .select("*, job:jobs(name, color)")
        .eq("user_id", ctx.userId)
        .order("event_at", { ascending: false })
        .limit(5),
      getUpcomingPaydays(ctx.userId, ctx.timezone),
      // This year and next, so a window crossing New Year still works.
      holidayRegion
        ? getRegionHolidays(holidayRegion, [Number(today.slice(0, 4)), Number(today.slice(0, 4)) + 1])
        : Promise.resolve([]),
    ]);

  const jobRates = Object.fromEntries(
    (jobs ?? []).map((job) => [
      job.id,
      {
        hourlyRateCents: job.hourly_rate ? dollarsToCents(job.hourly_rate) : 0,
        overtimeRateCents: job.overtime_rate ? dollarsToCents(job.overtime_rate) : null,
        overtimeThresholdMinutes: job.overtime_threshold_minutes,
      },
    ])
  );

  const toShiftInput = (shifts: typeof monthShifts) =>
    shifts
      .filter((s) => s.actual_start)
      .map((s) => ({
        jobId: s.job_id,
        start: s.actual_start!,
        end: s.actual_end,
        breaks: s.breaks.map((b) => ({ startedAt: b.started_at, endedAt: b.ended_at, isPaid: b.is_paid })),
      }));

  const todayShifts = monthShifts.filter(
    (s) => s.actual_start && s.actual_start >= day.start.toISOString() && s.actual_start < day.end.toISOString()
  );
  const weekShifts = monthShifts.filter(
    (s) => s.actual_start && s.actual_start >= week.start.toISOString() && s.actual_start < week.end.toISOString()
  );

  const todayTotals = sumJobSummaries(summarizeShiftsByJob(toShiftInput(todayShifts), jobRates));
  const weekTotals = sumJobSummaries(summarizeShiftsByJob(toShiftInput(weekShifts), jobRates));
  const monthTotals = sumJobSummaries(summarizeShiftsByJob(toShiftInput(monthShifts), jobRates));

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

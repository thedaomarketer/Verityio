import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/data/context";
import {
  addDaysToDateString,
  addMonthsToMonthString,
  calculateShiftDuration,
  holidayDisplayName,
  isDateString,
  isMonthString,
  localDateString,
  localDayStart,
  localMonthString,
} from "@/lib/calculations";
import { getHolidayRegion, getRegionHolidays } from "@/lib/data/holidays";
import { getI18n } from "@/lib/i18n/server";
import { formatMinutesAsHours, formatTime } from "@/lib/format";
import { MonthCalendar, type CalendarDay, type CalendarItem } from "@/components/calendar/month-calendar";

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ month?: string; day?: string }> }) {
  const [params, ctx, { locale, intl, m }] = await Promise.all([searchParams, requireUserContext(), getI18n()]);
  if (!ctx) redirect("/login");

  // `month` is a local "yyyy-mm"; its bounds are midnight on the 1st in the
  // user's zone -- never `new Date("yyyy-mm-01")`, which the server reads as UTC.
  const now = new Date();
  const today = localDateString(now, ctx.timezone);
  const month = params.month && isMonthString(params.month) ? params.month : localMonthString(now, ctx.timezone);
  const prevMonth = addMonthsToMonthString(month, -1);
  const nextMonth = addMonthsToMonthString(month, 1);
  const firstDay = `${month}-01`;
  const lastDay = addDaysToDateString(`${nextMonth}-01`, -1);
  const start = localDayStart(firstDay, ctx.timezone);
  const end = localDayStart(`${nextMonth}-01`, ctx.timezone);

  const supabase = await createClient();
  const [{ data: worked }, { data: planned }, { data: scheduleEntries }, holidayRegion] = await Promise.all([
    supabase
      .from("shifts")
      .select("*, breaks(*), job:jobs(name, color)")
      .eq("user_id", ctx.userId)
      .not("actual_start", "is", null)
      .gte("actual_start", start.toISOString())
      .lt("actual_start", end.toISOString())
      .order("actual_start"),
    // Shifts planned ahead (not yet clocked in).
    supabase
      .from("shifts")
      .select("*, job:jobs(name, color)")
      .eq("user_id", ctx.userId)
      .eq("status", "scheduled")
      .is("actual_start", null)
      .gte("scheduled_start", start.toISOString())
      .lt("scheduled_start", end.toISOString())
      .order("scheduled_start"),
    supabase
      .from("schedule_entries")
      .select("*, job:jobs(name, color)")
      .eq("user_id", ctx.userId)
      .gte("start_at", start.toISOString())
      .lt("start_at", end.toISOString())
      .order("start_at"),
    getHolidayRegion(supabase, ctx.userId),
  ]);

  const monthHolidays = holidayRegion
    ? (await getRegionHolidays(holidayRegion, [Number(month.slice(0, 4))])).filter((h) => h.date >= firstDay && h.date <= lastDay)
    : [];

  const range = (from: string, to: string | null) =>
    `${formatTime(from, ctx.timezone, intl)}${to ? ` – ${formatTime(to, ctx.timezone, intl)}` : ""}`;

  const entries: { date: string; at: string; item: CalendarItem; minutes?: number }[] = [
    ...monthHolidays.map((h) => ({
      date: h.date,
      at: "",
      item: { id: `holiday-${h.date}-${h.name}`, label: holidayDisplayName(h, locale), time: "", color: "var(--success)", kind: "holiday" as const },
    })),
    ...(worked ?? []).map((s) => {
      const { paidMinutes, isComplete } = calculateShiftDuration({
        start: s.actual_start!,
        end: s.actual_end,
        breaks: s.breaks.map((b) => ({ startedAt: b.started_at, endedAt: b.ended_at, isPaid: b.is_paid })),
      });
      return {
        date: localDateString(s.actual_start!, ctx.timezone),
        at: s.actual_start!,
        minutes: isComplete ? paidMinutes : undefined,
        item: {
          id: `shift-${s.id}`,
          label: s.job?.name ?? m.calendar.shift,
          time: range(s.actual_start!, s.actual_end),
          color: s.job?.color ?? "#8e8e93",
          kind: s.status === "active" ? ("active" as const) : ("worked" as const),
          duration: isComplete ? formatMinutesAsHours(paidMinutes, locale) : undefined,
        },
      };
    }),
    ...(planned ?? [])
      .filter((s) => s.scheduled_start)
      .map((s) => ({
        date: localDateString(s.scheduled_start!, ctx.timezone),
        at: s.scheduled_start!,
        item: {
          id: `planned-${s.id}`,
          label: s.job?.name ?? m.calendar.shift,
          time: range(s.scheduled_start!, s.scheduled_end),
          color: s.job?.color ?? "#8e8e93",
          kind: "scheduled" as const,
        },
      })),
    ...(scheduleEntries ?? []).map((s) => ({
      date: localDateString(s.start_at, ctx.timezone),
      at: s.start_at,
      item: {
        id: `sched-${s.id}`,
        label: s.job?.name ?? m.calendar.scheduled,
        time: range(s.start_at, s.end_at),
        color: s.job?.color ?? "#8e8e93",
        kind: "scheduled" as const,
      },
    })),
  ].sort((a, b) => a.date.localeCompare(b.date) || a.at.localeCompare(b.at));

  const dates: string[] = [];
  for (let d = firstDay; d <= lastDay; d = addDaysToDateString(d, 1)) dates.push(d);

  const minutesByDate = new Map<string, number>();
  const days: Record<string, CalendarDay> = {};
  for (const entry of entries) {
    (days[entry.date] ??= { items: [] }).items.push(entry.item);
    if (entry.minutes) minutesByDate.set(entry.date, (minutesByDate.get(entry.date) ?? 0) + entry.minutes);
  }
  for (const [date, minutes] of minutesByDate) days[date].worked = formatMinutesAsHours(minutes, locale);

  // Noon UTC keeps the label on the right calendar date in every zone.
  const dayLabels = Object.fromEntries(
    dates.map((d) => [
      d,
      new Date(`${d}T12:00:00Z`).toLocaleDateString(intl, { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" }),
    ])
  );
  // Jan 4 2026 is a Sunday; columns start on the user's first day of the week.
  const weekdayLabels = Array.from({ length: 7 }, (_, i) =>
    new Date(Date.UTC(2026, 0, 4 + ((ctx.weekStartsOn + i) % 7), 12)).toLocaleDateString(intl, { weekday: "narrow", timeZone: "UTC" })
  );
  const weekendColumns = [0, 6].map((weekday) => (weekday - ctx.weekStartsOn + 7) % 7);
  const firstWeekday = new Date(`${firstDay}T12:00:00Z`).getUTCDay();
  const leadingBlanks = (firstWeekday - ctx.weekStartsOn + 7) % 7;

  const initialSelected =
    params.day && isDateString(params.day) && params.day >= firstDay && params.day <= lastDay
      ? params.day
      : today >= firstDay && today <= lastDay
        ? today
        : firstDay;

  return (
    <div className="space-y-4">
      <MonthCalendar
        key={month}
        monthTitle={start.toLocaleDateString(intl, { month: "long", timeZone: ctx.timezone })}
        yearTitle={month.slice(0, 4)}
        weekdayLabels={weekdayLabels}
        weekendColumns={weekendColumns}
        leadingBlanks={leadingBlanks}
        dates={dates}
        dayLabels={dayLabels}
        days={days}
        today={today}
        initialSelected={initialSelected}
        prevHref={`/calendar?month=${prevMonth}`}
        nextHref={`/calendar?month=${nextMonth}`}
        todayHref="/calendar"
      />
      {!holidayRegion && (
        <p className="text-sm text-muted-foreground">
          <Link href="/taxes" className="text-primary hover:underline">
            {m.holidays.setRegionHint}
          </Link>
        </p>
      )}
    </div>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, ChevronRight, Flag } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/data/context";
import {
  addDaysToDateString,
  addMonthsToMonthString,
  holidayDisplayName,
  isMonthString,
  localDayStart,
  localMonthString,
} from "@/lib/calculations";
import { getHolidayRegion, getRegionHolidays } from "@/lib/data/holidays";
import { getI18n } from "@/lib/i18n/server";
import { formatDate, formatTime } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const [params, ctx, { locale, intl, m }] = await Promise.all([searchParams, requireUserContext(), getI18n()]);
  if (!ctx) redirect("/login");

  // `month` is a local "yyyy-mm"; its bounds are midnight on the 1st in the
  // user's zone -- never `new Date("yyyy-mm-01")`, which the server reads as UTC.
  const month =
    params.month && isMonthString(params.month) ? params.month : localMonthString(new Date(), ctx.timezone);
  const prevMonth = addMonthsToMonthString(month, -1);
  const nextMonth = addMonthsToMonthString(month, 1);
  const start = localDayStart(`${month}-01`, ctx.timezone);
  const end = localDayStart(`${nextMonth}-01`, ctx.timezone);

  const supabase = await createClient();
  const [{ data: shifts }, { data: scheduleEntries }] = await Promise.all([
    supabase
      .from("shifts")
      .select("*, job:jobs(name, color)")
      .eq("user_id", ctx.userId)
      .not("actual_start", "is", null)
      .gte("actual_start", start.toISOString())
      .lt("actual_start", end.toISOString())
      .order("actual_start"),
    supabase
      .from("schedule_entries")
      .select("*, job:jobs(name, color)")
      .eq("user_id", ctx.userId)
      .gte("start_at", start.toISOString())
      .lt("start_at", end.toISOString())
      .order("start_at"),
  ]);

  // Public holidays in this month for the user's province/state (Nager.Date).
  const holidayRegion = await getHolidayRegion(supabase, ctx.userId);
  const lastDay = addDaysToDateString(`${nextMonth}-01`, -1);
  const monthHolidays = holidayRegion
    ? (await getRegionHolidays(holidayRegion, [Number(month.slice(0, 4))])).filter(
        (h) => h.date >= `${month}-01` && h.date <= lastDay
      )
    : [];

  type Item = {
    id: string;
    at: string;
    label: string;
    sub: string;
    color: string;
    badge: string;
    holiday?: boolean;
  };
  const items: Item[] = [
    ...(shifts ?? []).map((s) => ({
      id: `shift-${s.id}`,
      at: s.actual_start!,
      label: s.job?.name ?? m.calendar.shift,
      sub: `${formatTime(s.actual_start!, ctx.timezone, intl)}${s.actual_end ? ` – ${formatTime(s.actual_end, ctx.timezone, intl)}` : ""}`,
      color: s.job?.color ?? "#525252",
      badge: s.status === "active" ? m.calendar.workingNow : m.calendar.worked,
    })),
    ...(scheduleEntries ?? []).map((s) => ({
      id: `sched-${s.id}`,
      at: s.start_at,
      label: s.job?.name ?? m.calendar.scheduled,
      sub: `${formatTime(s.start_at, ctx.timezone, intl)} – ${formatTime(s.end_at, ctx.timezone, intl)}`,
      color: s.job?.color ?? "#525252",
      badge: m.calendar.scheduled,
    })),
    // Anchored at local midnight so a holiday sorts first within its own day.
    ...monthHolidays.map((h) => ({
      id: `holiday-${h.date}-${h.name}`,
      at: localDayStart(h.date, ctx.timezone).toISOString(),
      label: holidayDisplayName(h, locale),
      sub: "",
      color: "var(--success)",
      badge: m.holidays.holiday,
      holiday: true,
    })),
  ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  const byDate = new Map<string, Item[]>();
  for (const item of items) {
    const key = formatDate(item.at, ctx.timezone, intl);
    byDate.set(key, [...(byDate.get(key) ?? []), item]);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-[28px] leading-tight font-bold tracking-tight md:text-3xl">
          {start.toLocaleDateString(intl, { month: "long", year: "numeric", timeZone: ctx.timezone })}
        </h1>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="icon">
            <Link href={`/calendar?month=${prevMonth}`} aria-label={m.calendar.previousMonth}>
              <ChevronLeft className="size-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="icon">
            <Link href={`/calendar?month=${nextMonth}`} aria-label={m.calendar.nextMonth}>
              <ChevronRight className="size-4" />
            </Link>
          </Button>
        </div>
      </div>

      {!holidayRegion && (
        <p className="text-sm text-muted-foreground">
          <Link href="/taxes" className="text-primary hover:underline">
            {m.holidays.setRegionHint}
          </Link>
        </p>
      )}

      {byDate.size === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {m.calendar.empty}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {[...byDate.entries()].map(([date, dayItems]) => (
            <Card key={date}>
              <CardContent className="py-4">
                <p className="mb-2 text-sm font-medium">{date}</p>
                <ul className="space-y-2">
                  {dayItems.map((item) => (
                    <li key={item.id} className="flex items-center gap-2 text-sm">
                      {item.holiday ? (
                        <Flag className="size-3.5 shrink-0 text-success" aria-hidden="true" />
                      ) : (
                        <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                      )}
                      <span className="font-medium">{item.label}</span>
                      <span className="text-muted-foreground">{item.sub}</span>
                      <Badge variant={item.holiday ? "success" : "outline"} className="ml-auto">
                        {item.badge}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

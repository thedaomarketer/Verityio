import { redirect } from "next/navigation";

import { getDashboardData } from "@/lib/data/dashboard";
import { formatCents } from "@/lib/calculations";
import { formatMinutesAsHours } from "@/lib/format";
import { getI18n } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n/config";
import { ActiveShiftCard } from "@/components/time/active-shift-card";
import { ClockInCard } from "@/components/time/clock-in-card";
import { WeekHero } from "@/components/dashboard/week-hero";
import { UpcomingShifts } from "@/components/dashboard/upcoming-shifts";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { NextPaydayCard } from "@/components/dashboard/next-payday-card";
import { WeekProgress } from "@/components/dashboard/week-progress";

export default async function DashboardPage() {
  const [data, { locale, intl, m }] = await Promise.all([getDashboardData(), getI18n()]);
  if (!data) redirect("/login");
  const fmtHrs = (minutes: number) => formatMinutesAsHours(minutes, locale);

  const today = new Date();
  const dateLabel = today.toLocaleDateString(intl, {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: data.timezone,
  });

  const hour = Number(
    new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: data.timezone }).format(today)
  );
  const greeting =
    hour < 12 ? m.dashboard.goodMorning : hour < 18 ? m.dashboard.goodAfternoon : m.dashboard.goodEvening;
  const firstName = data.fullName?.split(" ")[0];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[28px] leading-tight font-bold tracking-tight md:text-3xl">
          {firstName ? fmt(m.dashboard.greetingWithName, { greeting, name: firstName }) : greeting}
        </h1>
        <p className="text-sm text-muted-foreground">{dateLabel}</p>
      </div>

      {data.activeShift ? (
        <ActiveShiftCard
          shift={{
            id: data.activeShift.id,
            actual_start: data.activeShift.actual_start!,
            job: data.activeShift.job,
            breaks: data.activeShift.breaks,
          }}
          timezone={data.timezone}
        />
      ) : (
        <ClockInCard jobs={data.jobs} />
      )}

      <WeekHero
        title={m.common.thisWeek}
        earnings={formatCents(data.weekTotals.earningsCents, data.currency, intl)}
        earningsLabel={m.dashboard.estEarningsHint}
        href="/reports"
        linkLabel={m.nav.reports}
        stats={[
          { label: m.dashboard.hoursWorked, value: fmtHrs(data.weekTotals.paidMinutes) },
          { label: m.common.overtime, value: fmtHrs(data.weekTotals.overtimeMinutes) },
          { label: m.dashboard.today, value: fmtHrs(data.todayTotals.paidMinutes) },
        ]}
      />

      {data.nextPayday && <NextPaydayCard payday={data.nextPayday} timezone={data.timezone} />}

      {data.overtimeThresholdMinutes && (
        <WeekProgress workedMinutes={data.weekTotals.paidMinutes} thresholdMinutes={data.overtimeThresholdMinutes} />
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <RecentActivity
          journalEntries={data.journalEntries}
          completedShifts={data.recentCompletedShifts}
          timezone={data.timezone}
        />
        <UpcomingShifts shifts={data.upcomingShifts} holidays={data.upcomingHolidays} timezone={data.timezone} />
      </div>
    </div>
  );
}

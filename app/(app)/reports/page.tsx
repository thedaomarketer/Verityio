import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/data/context";
import {
  addDaysToDateString,
  addMonthsToMonthString,
  dollarsToCents,
  formatCents,
  isDateString,
  localDayStart,
  localMonthString,
  summarizeByWeek,
  summarizeShiftsByJob,
  sumJobSummaries,
} from "@/lib/calculations";
import { formatMinutesAsHours, formatShortDate } from "@/lib/format";
import { getI18n } from "@/lib/i18n/server";
import type { ExpenseCategory } from "@/lib/supabase/database.types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Download } from "lucide-react";
import { TimeSeriesBarChart } from "@/components/charts/time-series-bar-chart";
import { CategoryBarChart } from "@/components/charts/category-bar-chart";

const MAX_TREND_WEEKS = 16;

const EXPENSE_CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  meals: "var(--chart-1)",
  transport: "var(--chart-2)",
  supplies: "var(--chart-3)",
  equipment: "var(--chart-4)",
  lodging: "var(--chart-5)",
  other: "var(--chart-6)",
};

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ start?: string; end?: string }>;
}) {
  const [params, ctx, { locale, intl, m }] = await Promise.all([searchParams, requireUserContext(), getI18n()]);
  if (!ctx) redirect("/login");

  const fmtHours = (minutes: number) => formatMinutesAsHours(minutes, locale);
  const fmtCents = (cents: number) => formatCents(cents, ctx.currency, intl);

  // The range is a pair of inclusive local calendar dates (default: this
  // month). Shifts are matched on instants -- local midnight on the first
  // day up to local midnight after the last -- in the user's time zone.
  const thisMonth = localMonthString(new Date(), ctx.timezone);
  const startDate = params.start && isDateString(params.start) ? params.start : `${thisMonth}-01`;
  const endDate =
    params.end && isDateString(params.end)
      ? params.end
      : addDaysToDateString(`${addMonthsToMonthString(thisMonth, 1)}-01`, -1);
  const rangeStart = localDayStart(startDate, ctx.timezone);
  const rangeEnd = localDayStart(addDaysToDateString(endDate, 1), ctx.timezone);

  const supabase = await createClient();
  const [{ data: jobs }, { data: shifts }, { data: expenses }, { data: mileage }] = await Promise.all([
    supabase.from("jobs").select("*").eq("user_id", ctx.userId),
    supabase
      .from("shifts")
      .select("*, breaks(*)")
      .eq("user_id", ctx.userId)
      .eq("status", "completed")
      .gte("actual_start", rangeStart.toISOString())
      .lt("actual_start", rangeEnd.toISOString()),
    supabase
      .from("expenses")
      .select("*")
      .eq("user_id", ctx.userId)
      .gte("expense_date", startDate)
      .lte("expense_date", endDate),
    supabase
      .from("mileage_entries")
      .select("*")
      .eq("user_id", ctx.userId)
      .gte("date", startDate)
      .lte("date", endDate),
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

  const shiftInputs = (shifts ?? [])
    .filter((s) => s.actual_start)
    .map((s) => ({
      jobId: s.job_id,
      start: s.actual_start!,
      end: s.actual_end,
      breaks: s.breaks.map((b) => ({ startedAt: b.started_at, endedAt: b.ended_at, isPaid: b.is_paid })),
    }));

  const summaries = summarizeShiftsByJob(shiftInputs, jobRates);

  const totals = sumJobSummaries(summaries);
  const totalExpensesCents = (expenses ?? []).reduce((sum, e) => sum + dollarsToCents(e.amount), 0);
  const totalMileageCents = (mileage ?? []).reduce((sum, t) => sum + dollarsToCents(t.reimbursement), 0);

  const jobsById = new Map((jobs ?? []).map((j) => [j.id, j]));
  const csvParams = new URLSearchParams({ start: startDate, end: endDate }).toString();

  const weeklyTotals = summarizeByWeek(shiftInputs, jobRates, ctx.timezone, ctx.weekStartsOn, rangeStart, rangeEnd);
  const showWeeklyTrend = weeklyTotals.length > 1 && weeklyTotals.length <= MAX_TREND_WEEKS;

  const weeklyHoursData = weeklyTotals.map((week) => ({
    label: formatShortDate(week.weekStart, ctx.timezone, intl),
    values: { regular: week.regularMinutes, overtime: week.overtimeMinutes },
  }));
  const weeklyEarningsData = weeklyTotals.map((week) => ({
    label: formatShortDate(week.weekStart, ctx.timezone, intl),
    values: { earnings: week.earningsCents },
  }));

  const hoursByJobData = Object.entries(summaries).map(([jobId, summary]) => ({
    label: jobsById.get(jobId)?.name ?? m.common.unknownJob,
    value: summary.paidMinutes,
    color: jobsById.get(jobId)?.color ?? "var(--chart-1)",
  }));
  const earningsByJobData = Object.entries(summaries).map(([jobId, summary]) => ({
    label: jobsById.get(jobId)?.name ?? m.common.unknownJob,
    value: summary.earningsCents,
    color: jobsById.get(jobId)?.color ?? "var(--chart-1)",
  }));

  const expensesByCategory = new Map<ExpenseCategory, number>();
  for (const expense of expenses ?? []) {
    expensesByCategory.set(
      expense.category,
      (expensesByCategory.get(expense.category) ?? 0) + dollarsToCents(expense.amount)
    );
  }
  const expensesByCategoryData = [...expensesByCategory.entries()].map(([category, cents]) => ({
    label: m.expenses.categories[category],
    value: cents,
    color: EXPENSE_CATEGORY_COLORS[category],
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-[28px] leading-tight font-bold tracking-tight md:text-3xl">{m.reports.title}</h1>
        <form className="flex flex-wrap items-end gap-2" action="/reports">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground" htmlFor="start">
              {m.reports.from}
            </label>
            <input
              id="start"
              name="start"
              type="date"
              defaultValue={startDate}
              className="flex h-10 rounded-xl bg-card px-3 text-base shadow-[0_1px_2px_rgb(0_0_0/0.05)] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25 md:text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground" htmlFor="end">
              {m.reports.to}
            </label>
            <input
              id="end"
              name="end"
              type="date"
              defaultValue={endDate}
              className="flex h-10 rounded-xl bg-card px-3 text-base shadow-[0_1px_2px_rgb(0_0_0/0.05)] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25 md:text-sm"
            />
          </div>
          <Button type="submit" variant="outline">
            {m.reports.apply}
          </Button>
        </form>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="gap-1.5">
          <CardHeader>
            <CardTitle className="text-sm font-normal text-muted-foreground">{m.reports.totalHours}</CardTitle>
          </CardHeader>
          <CardContent className="text-[26px] leading-tight font-bold tracking-tight">{fmtHours(totals.paidMinutes)}</CardContent>
        </Card>
        <Card className="gap-1.5">
          <CardHeader>
            <CardTitle className="text-sm font-normal text-muted-foreground">{m.common.overtime}</CardTitle>
          </CardHeader>
          <CardContent className="text-[26px] leading-tight font-bold tracking-tight">{fmtHours(totals.overtimeMinutes)}</CardContent>
        </Card>
        <Card className="gap-1.5">
          <CardHeader>
            <CardTitle className="text-sm font-normal text-muted-foreground">{m.common.earnings}</CardTitle>
          </CardHeader>
          <CardContent className="text-[26px] leading-tight font-bold tracking-tight">{fmtCents(totals.earningsCents)}</CardContent>
        </Card>
        <Card className="gap-1.5">
          <CardHeader>
            <CardTitle className="text-sm font-normal text-muted-foreground">{m.reports.expensesAndMileage}</CardTitle>
          </CardHeader>
          <CardContent className="text-[26px] leading-tight font-bold tracking-tight">
            {fmtCents(totalExpensesCents + totalMileageCents)}
          </CardContent>
        </Card>
      </div>

      {showWeeklyTrend && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{m.reports.hoursByWeek}</CardTitle>
            </CardHeader>
            <CardContent>
              <TimeSeriesBarChart
                data={weeklyHoursData}
                series={[
                  { key: "regular", label: m.reports.regular, colorClassName: "bg-chart-1" },
                  { key: "overtime", label: m.common.overtime, colorClassName: "bg-chart-2" },
                ]}
                formatValue={fmtHours}
                emptyMessage={m.reports.noShifts}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{m.reports.earningsByWeek}</CardTitle>
            </CardHeader>
            <CardContent>
              <TimeSeriesBarChart
                data={weeklyEarningsData}
                series={[{ key: "earnings", label: m.common.earnings, colorClassName: "bg-chart-1" }]}
                formatValue={fmtCents}
                emptyMessage={m.reports.noShifts}
              />
            </CardContent>
          </Card>
        </>
      )}

      {(hoursByJobData.length > 0 || earningsByJobData.length > 0) && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{m.reports.hoursByJob}</CardTitle>
            </CardHeader>
            <CardContent>
              <CategoryBarChart
                data={hoursByJobData}
                formatValue={fmtHours}
                emptyMessage={m.reports.noShifts}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{m.reports.earningsByJob}</CardTitle>
            </CardHeader>
            <CardContent>
              <CategoryBarChart
                data={earningsByJobData}
                formatValue={fmtCents}
                emptyMessage={m.reports.noShifts}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {expensesByCategoryData.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">{m.reports.expensesByCategory}</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <a href="/expenses">{m.reports.viewAll}</a>
            </Button>
          </CardHeader>
          <CardContent>
            <CategoryBarChart
              data={expensesByCategoryData}
              formatValue={fmtCents}
              emptyMessage={m.reports.noExpenses}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">{m.reports.byJob}</CardTitle>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <a href={`/api/reports/csv/shifts?${csvParams}`}>
                <Download /> {m.reports.hoursCsv}
              </a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href={`/api/reports/csv/expenses?${csvParams}`}>
                <Download /> {m.reports.expensesCsv}
              </a>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-0 sm:px-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{m.common.job}</TableHead>
                <TableHead className="text-right">{m.reports.regular}</TableHead>
                <TableHead className="text-right">{m.common.overtime}</TableHead>
                <TableHead className="text-right">{m.common.earnings}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(summaries).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">
                    {m.reports.noShifts}
                  </TableCell>
                </TableRow>
              ) : (
                Object.entries(summaries).map(([jobId, summary]) => (
                  <TableRow key={jobId}>
                    <TableCell>{jobsById.get(jobId)?.name ?? m.common.unknownJob}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {fmtHours(summary.regularMinutes)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {fmtHours(summary.overtimeMinutes)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{fmtCents(summary.earningsCents)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

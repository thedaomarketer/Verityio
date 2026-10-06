import Link from "next/link";
import { redirect } from "next/navigation";
import { Download, Lock } from "lucide-react";

import { requireUserContext } from "@/lib/data/context";
import { hasFeature } from "@/lib/data/subscription";
import { getReportData, type ReportSearchParams } from "@/lib/data/reports";
import {
  dollarsToCents,
  fitGranularity,
  formatCents,
  FREE_REPORT_PRESETS,
  hourlyRateCents,
  isGranularity,
  REPORT_PRESETS,
} from "@/lib/calculations";
import { formatBucketLabel, formatCalendarDate, formatMinutesAsHours, formatShortDate } from "@/lib/format";
import { GranularityTabs } from "@/components/reports/granularity-tabs";
import { getI18n } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n/config";
import type { ExpenseCategory } from "@/lib/supabase/database.types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MetricCard } from "@/components/dashboard/metric-card";
import { TimeSeriesBarChart } from "@/components/charts/time-series-bar-chart";
import { CategoryBarChart } from "@/components/charts/category-bar-chart";
import { DonutChart } from "@/components/charts/donut-chart";
import { LineChart } from "@/components/charts/line-chart";
import { PrintButton } from "@/components/reports/print-button";
import { DownloadButton } from "@/components/download-button";
import { cn } from "@/lib/utils";

const MAX_BAR_WEEKS = 16;

const EXPENSE_CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  meals: "var(--chart-1)",
  transport: "var(--chart-2)",
  supplies: "var(--chart-3)",
  equipment: "var(--chart-4)",
  lodging: "var(--chart-5)",
  other: "var(--chart-6)",
};

export default async function ReportsPage({ searchParams }: { searchParams: Promise<ReportSearchParams> }) {
  const [params, ctx, { locale, intl, m }] = await Promise.all([searchParams, requireUserContext(), getI18n()]);
  if (!ctx) redirect("/login");
  const premium = await hasFeature(ctx.userId, "reports");

  const fmtHours = (minutes: number) => formatMinutesAsHours(minutes, locale);
  const fmtCents = (cents: number) => formatCents(cents, ctx.currency, intl);
  const moneyFormat = { kind: "money" as const, currency: ctx.currency, intl };

  const data = await getReportData(ctx, params, premium);
  const { range, summaries, totals, jobsById, expenses, totalExpensesCents, totalMileageCents, rangeQuery } = data;
  const { start: startDate, end: endDate } = range;
  const avgRate = hourlyRateCents(totals.earningsCents, totals.paidMinutes);
  const csvParams = new URLSearchParams({ start: startDate, end: endDate }).toString();
  const breakdown = (metric: string) => `/reports/${metric}?${rangeQuery}`;

  const weeklyTotals = data.bucketTotals("week");
  const weekLabel = (week: (typeof weeklyTotals)[number]) => formatShortDate(week.start, ctx.timezone, intl);

  // Earnings over time, at the granularity the user picks (default weekly).
  const wanted = isGranularity(params.by) ? params.by : "week";
  const granularity = fitGranularity(startDate, endDate, wanted);
  const earningsBuckets = data.bucketTotals(granularity);
  const earningsSeries = earningsBuckets.map((bucket) => ({
    label: formatBucketLabel(bucket, granularity, ctx.timezone, intl),
    values: { earnings: bucket.earningsCents },
  }));

  const jobSlices = Object.entries(summaries).map(([jobId, summary]) => ({
    key: jobId,
    label: jobsById.get(jobId)?.name ?? m.common.unknownJob,
    hours: summary.paidMinutes,
    earnings: summary.earningsCents,
    color: jobsById.get(jobId)?.color ?? "var(--chart-1)",
  }));

  const expensesByCategory = new Map<ExpenseCategory, number>();
  for (const expense of expenses) {
    expensesByCategory.set(expense.category, (expensesByCategory.get(expense.category) ?? 0) + dollarsToCents(expense.amount));
  }
  const expenseSlices = [...expensesByCategory.entries()].map(([category, cents]) => ({
    key: category,
    label: m.expenses.categories[category],
    value: cents,
    color: EXPENSE_CATEGORY_COLORS[category],
  }));

  const rangeLabel = `${formatCalendarDate(startDate, intl)} – ${formatCalendarDate(endDate, intl)}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[28px] leading-tight font-bold tracking-tight md:text-3xl">{m.reports.title}</h1>
          <p className="text-sm text-muted-foreground">{rangeLabel}</p>
        </div>
        <div className="print-hidden flex flex-wrap gap-2">
          {premium ? (
            <>
              <PrintButton label={m.reports.savePdf} />
              <DownloadButton href={`/api/reports/csv/shifts?${csvParams}`} fallbackName="verityio-hours.csv">
                <Download /> {m.reports.hoursCsv}
              </DownloadButton>
              <DownloadButton href={`/api/reports/csv/expenses?${csvParams}`} fallbackName="verityio-expenses.csv">
                <Download /> {m.reports.expensesCsv}
              </DownloadButton>
            </>
          ) : (
            <Button asChild variant="outline" size="sm">
              <Link href="/premium">
                <Lock /> {m.reports.exportsPremium}
              </Link>
            </Button>
          )}
        </div>
      </div>

      <div className="print-hidden space-y-3">
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
          {REPORT_PRESETS.map((preset) => {
            const available = premium || FREE_REPORT_PRESETS.includes(preset);
            const active = range.preset === preset;
            return (
              <Link
                key={preset}
                href={available ? `/reports?range=${preset}` : "/premium"}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium transition-colors",
                  active ? "bg-foreground text-background" : "bg-card text-foreground shadow-[0_1px_2px_rgb(0_0_0/0.06)] hover:bg-accent"
                )}
              >
                {!available && <Lock className="size-3.5 text-muted-foreground" aria-label={m.premium.badge} />}
                {m.reports.presets[preset]}
              </Link>
            );
          })}
        </div>

        <form className="grid grid-cols-2 items-end gap-2 sm:flex" action="/reports">
          <div className="min-w-0 space-y-1">
            <label className="text-xs text-muted-foreground" htmlFor="start">
              {m.reports.from}
            </label>
            <input
              id="start"
              name="start"
              type="date"
              defaultValue={startDate}
              className="flex h-11 w-full min-w-0 appearance-none rounded-xl bg-card px-3 text-base shadow-[0_1px_2px_rgb(0_0_0/0.05)] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25 sm:w-44 md:text-sm"
            />
          </div>
          <div className="min-w-0 space-y-1">
            <label className="text-xs text-muted-foreground" htmlFor="end">
              {m.reports.to}
            </label>
            <input
              id="end"
              name="end"
              type="date"
              defaultValue={endDate}
              className="flex h-11 w-full min-w-0 appearance-none rounded-xl bg-card px-3 text-base shadow-[0_1px_2px_rgb(0_0_0/0.05)] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25 sm:w-44 md:text-sm"
            />
          </div>
          <Button type="submit" variant="outline" className="col-span-2 h-11">
            {m.reports.apply}
          </Button>
        </form>
        {range.locked && (
          <p className="rounded-2xl bg-secondary px-4 py-3 text-sm text-muted-foreground">
            {m.reports.rangeLocked}{" "}
            <Link href="/premium" className="font-semibold text-primary">
              {m.premium.seePlans}
            </Link>
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <MetricCard href={breakdown("hours")} label={m.reports.totalHours} value={fmtHours(totals.paidMinutes)} />
        <MetricCard href={breakdown("overtime")} label={m.common.overtime} value={fmtHours(totals.overtimeMinutes)} />
        <MetricCard href={breakdown("earnings")} label={m.reports.estEarnings} value={fmtCents(totals.earningsCents)} sub={m.reports.beforeDeductions} />
        <MetricCard href={breakdown("rate")} label={m.reports.avgPerHour} value={avgRate !== null ? fmtCents(avgRate) : "—"} />
        <MetricCard href={breakdown("expenses")} label={m.nav.expenses} value={fmtCents(totalExpensesCents)} />
        <MetricCard href={breakdown("mileage")} label={m.nav.mileage} value={fmtCents(totalMileageCents)} />
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base">{m.reports.earningsOverTime}</CardTitle>
          <GranularityTabs
            basePath="/reports"
            query={rangeQuery}
            current={granularity}
            labels={m.reports.granularity}
            label={m.reports.earningsOverTime}
          />
        </CardHeader>
        <CardContent>
          {premium && earningsSeries.length > 1 ? (
            <LineChart
              data={earningsSeries}
              series={[{ key: "earnings", label: m.common.earnings, color: "var(--chart-1)" }]}
              format={moneyFormat}
              emptyMessage={m.reports.noShifts}
              caption={m.reports.earningsOverTime}
            />
          ) : earningsSeries.length <= 31 ? (
            <TimeSeriesBarChart
              data={earningsSeries}
              series={[{ key: "earnings", label: m.common.earnings, colorClassName: "bg-chart-1" }]}
              formatValue={fmtCents}
              emptyMessage={m.reports.noShifts}
            />
          ) : (
            <Link href={breakdown("earnings") + `&by=${granularity}`} className="text-sm font-semibold text-primary">
              {m.reports.seeBreakdown}
            </Link>
          )}
        </CardContent>
      </Card>

      {weeklyTotals.length > 1 && (
        <div className="grid gap-4">
          {weeklyTotals.length <= MAX_BAR_WEEKS && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{m.reports.hoursByWeek}</CardTitle>
              </CardHeader>
              <CardContent>
                <TimeSeriesBarChart
                  data={weeklyTotals.map((week) => ({
                    label: weekLabel(week),
                    values: { regular: week.regularMinutes, overtime: week.overtimeMinutes },
                  }))}
                  series={[
                    { key: "regular", label: m.reports.regular, colorClassName: "bg-chart-1" },
                    { key: "overtime", label: m.common.overtime, colorClassName: "bg-chart-2" },
                  ]}
                  formatValue={fmtHours}
                  emptyMessage={m.reports.noShifts}
                />
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {(jobSlices.length > 0 || expenseSlices.length > 0) && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{premium ? m.reports.hoursSplit : m.reports.earningsByJob}</CardTitle>
            </CardHeader>
            <CardContent>
              {premium ? (
                <DonutChart
                  data={jobSlices.map((job) => ({ key: job.key, label: job.label, value: job.hours, color: job.color }))}
                  format={{ kind: "hours", locale }}
                  totalLabel={m.reports.totalHours}
                  otherLabel={m.reports.otherJobs}
                  emptyMessage={m.reports.noShifts}
                />
              ) : (
                <CategoryBarChart
                  data={jobSlices.map((job) => ({ label: job.label, value: job.earnings, color: job.color }))}
                  formatValue={fmtCents}
                  emptyMessage={m.reports.noShifts}
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-base">{m.reports.expensesByCategory}</CardTitle>
              <Button asChild variant="ghost" size="sm" className="print-hidden">
                <Link href="/expenses">{m.reports.viewAll}</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {premium ? (
                <DonutChart
                  data={expenseSlices}
                  format={moneyFormat}
                  totalLabel={m.reports.totalExpenses}
                  otherLabel={m.expenses.categories.other}
                  otherColor={EXPENSE_CATEGORY_COLORS.other}
                  emptyMessage={m.reports.noExpenses}
                />
              ) : (
                <CategoryBarChart data={expenseSlices} formatValue={fmtCents} emptyMessage={m.reports.noExpenses} />
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{m.reports.byJob}</CardTitle>
        </CardHeader>
        <CardContent className="px-0 sm:px-5">
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
                    <TableCell>
                      <span className="flex items-center gap-2">
                        <span
                          className="size-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: jobsById.get(jobId)?.color ?? "var(--chart-1)" }}
                          aria-hidden="true"
                        />
                        {jobsById.get(jobId)?.name ?? m.common.unknownJob}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{fmtHours(summary.regularMinutes)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtHours(summary.overtimeMinutes)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtCents(summary.earningsCents)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">{fmt(m.reports.footnote, { range: rangeLabel })}</p>
    </div>
  );
}

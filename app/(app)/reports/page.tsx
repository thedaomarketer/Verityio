import Link from "next/link";
import { redirect } from "next/navigation";
import { Crown, Download, Lock } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/data/context";
import { getEntitlement } from "@/lib/data/subscription";
import { jobRatesFrom, shiftInputsFrom } from "@/lib/data/earnings";
import {
  addDaysToDateString,
  dollarsToCents,
  formatCents,
  FREE_REPORT_PRESETS,
  getWorkweekBounds,
  hourlyRateCents,
  localDateString,
  localDayStart,
  REPORT_PRESETS,
  resolveReportRange,
  summarizeByWeek,
  summarizeShiftsByJob,
  sumJobSummaries,
} from "@/lib/calculations";
import { formatCalendarDate, formatMinutesAsHours, formatShortDate } from "@/lib/format";
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

/** A small "Premium" tag beside features a free plan can see but not use. */
function PremiumTag({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#f5a623]/15 px-2 py-0.5 text-[11px] font-semibold text-[#8a5300]">
      <Crown className="size-3" aria-hidden="true" />
      {label}
    </span>
  );
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; start?: string; end?: string }>;
}) {
  const [params, ctx, { locale, intl, m }] = await Promise.all([searchParams, requireUserContext(), getI18n()]);
  if (!ctx) redirect("/login");
  const { premium } = await getEntitlement(ctx.userId);

  const fmtHours = (minutes: number) => formatMinutesAsHours(minutes, locale);
  const fmtCents = (cents: number) => formatCents(cents, ctx.currency, intl);
  const moneyFormat = { kind: "money" as const, currency: ctx.currency, intl };

  // Inclusive local calendar dates; shifts are matched on instants from
  // local midnight on the first day to local midnight after the last.
  const now = new Date();
  const today = localDateString(now, ctx.timezone);
  const weekStart = localDateString(getWorkweekBounds(now, ctx.timezone, ctx.weekStartsOn).start, ctx.timezone);
  const range = resolveReportRange(params, { today, weekStart, premium });
  const { start: startDate, end: endDate } = range;
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
    supabase.from("expenses").select("*").eq("user_id", ctx.userId).gte("expense_date", startDate).lte("expense_date", endDate),
    supabase.from("mileage_entries").select("*").eq("user_id", ctx.userId).gte("date", startDate).lte("date", endDate),
  ]);

  const jobRates = jobRatesFrom(jobs ?? []);
  const shiftInputs = shiftInputsFrom(shifts ?? []);
  const summaries = summarizeShiftsByJob(shiftInputs, jobRates);
  const totals = sumJobSummaries(summaries);
  const totalExpensesCents = (expenses ?? []).reduce((sum, e) => sum + dollarsToCents(e.amount), 0);
  const totalMileageCents = (mileage ?? []).reduce((sum, t) => sum + dollarsToCents(t.reimbursement), 0);
  const avgRate = hourlyRateCents(totals.earningsCents, totals.paidMinutes);

  const jobsById = new Map((jobs ?? []).map((j) => [j.id, j]));
  const csvParams = new URLSearchParams({ start: startDate, end: endDate }).toString();

  const weeklyTotals = summarizeByWeek(shiftInputs, jobRates, ctx.timezone, ctx.weekStartsOn, rangeStart, rangeEnd);
  const weekLabel = (week: (typeof weeklyTotals)[number]) => formatShortDate(week.weekStart, ctx.timezone, intl);

  const jobSlices = Object.entries(summaries).map(([jobId, summary]) => ({
    key: jobId,
    label: jobsById.get(jobId)?.name ?? m.common.unknownJob,
    hours: summary.paidMinutes,
    earnings: summary.earningsCents,
    color: jobsById.get(jobId)?.color ?? "var(--chart-1)",
  }));

  const expensesByCategory = new Map<ExpenseCategory, number>();
  for (const expense of expenses ?? []) {
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

        {premium ? (
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
        ) : (
          range.locked && (
            <p className="rounded-2xl bg-secondary px-4 py-3 text-sm text-muted-foreground">
              {m.reports.rangeLocked}{" "}
              <Link href="/premium" className="font-semibold text-primary">
                {m.premium.seePremium}
              </Link>
            </p>
          )
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <MetricCard label={m.reports.totalHours} value={fmtHours(totals.paidMinutes)} />
        <MetricCard label={m.common.overtime} value={fmtHours(totals.overtimeMinutes)} />
        <MetricCard label={m.reports.estEarnings} value={fmtCents(totals.earningsCents)} sub={m.reports.beforeDeductions} />
        <MetricCard label={m.reports.avgPerHour} value={avgRate !== null ? fmtCents(avgRate) : "—"} />
        <MetricCard label={m.nav.expenses} value={fmtCents(totalExpensesCents)} />
        <MetricCard label={m.nav.mileage} value={fmtCents(totalMileageCents)} />
      </div>

      {weeklyTotals.length > 1 && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-base">{m.reports.earningsTrend}</CardTitle>
              {!premium && <PremiumTag label={m.premium.badge} />}
            </CardHeader>
            <CardContent>
              {premium ? (
                <LineChart
                  data={weeklyTotals.map((week) => ({ label: weekLabel(week), values: { earnings: week.earningsCents } }))}
                  series={[{ key: "earnings", label: m.common.earnings, color: "var(--chart-1)" }]}
                  format={moneyFormat}
                  emptyMessage={m.reports.noShifts}
                  caption={m.reports.earningsTrend}
                />
              ) : (
                <Link
                  href="/premium"
                  className="flex h-44 flex-col items-center justify-center gap-2 rounded-2xl bg-secondary/60 text-center text-sm text-muted-foreground transition-colors hover:bg-secondary"
                >
                  <Lock className="size-5" aria-hidden="true" />
                  {m.reports.trendPremium}
                </Link>
              )}
            </CardContent>
          </Card>

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

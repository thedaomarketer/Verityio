import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft, Paperclip } from "lucide-react";

import { requireUserContext } from "@/lib/data/context";
import { hasFeature } from "@/lib/data/subscription";
import { getReportData, type ReportSearchParams } from "@/lib/data/reports";
import {
  calculateShiftDuration,
  dollarsToCents,
  fitGranularity,
  formatCents,
  hourlyRateCents,
  isGranularity,
  type Granularity,
} from "@/lib/calculations";
import { formatBucketLabel, formatCalendarDate, formatMinutesAsHours, formatShortDate, formatTime } from "@/lib/format";
import { getI18n } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n/config";
import type { ExpenseCategory } from "@/lib/supabase/database.types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TimeSeriesBarChart } from "@/components/charts/time-series-bar-chart";
import { makeAxisFormatter } from "@/lib/charts/value-format";
import { CategoryBarChart } from "@/components/charts/category-bar-chart";
import { GranularityTabs } from "@/components/reports/granularity-tabs";
import { cn } from "@/lib/utils";

const METRICS = ["hours", "overtime", "earnings", "rate", "expenses", "mileage"] as const;
type Metric = (typeof METRICS)[number];

function isMetric(value: string): value is Metric {
  return (METRICS as readonly string[]).includes(value);
}

const EXPENSE_CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  meals: "var(--chart-1)",
  transport: "var(--chart-2)",
  supplies: "var(--chart-3)",
  equipment: "var(--chart-4)",
  lodging: "var(--chart-5)",
  other: "var(--chart-6)",
};

/**
 * The breakdown behind a Reports tile: the same range and the same
 * calculations (`getReportData`), split by day / week / month / year and by
 * job, down to the individual shifts, expenses or trips.
 */
export default async function ReportBreakdownPage({
  params,
  searchParams,
}: {
  params: Promise<{ metric: string }>;
  searchParams: Promise<ReportSearchParams>;
}) {
  const [{ metric }, query, ctx, { locale, intl, m }] = await Promise.all([params, searchParams, requireUserContext(), getI18n()]);
  if (!ctx) redirect("/login");
  if (!isMetric(metric)) notFound();
  const premium = await hasFeature(ctx.userId, "reports");
  const data = await getReportData(ctx, query, premium);

  const hours = (minutes: number) => formatMinutesAsHours(minutes, locale);
  const money = (cents: number) => formatCents(cents, ctx.currency, intl);
  const rate = (earned: number, minutes: number) => {
    const r = hourlyRateCents(earned, minutes);
    return r === null ? "—" : money(r);
  };
  const rangeLabel = `${formatCalendarDate(data.range.start, intl)} – ${formatCalendarDate(data.range.end, intl)}`;

  const titles: Record<Metric, string> = {
    hours: m.reports.totalHours,
    overtime: m.common.overtime,
    earnings: m.reports.estEarnings,
    rate: m.reports.avgPerHour,
    expenses: m.nav.expenses,
    mileage: m.nav.mileage,
  };
  const headline: Record<Metric, string> = {
    hours: hours(data.totals.paidMinutes),
    overtime: hours(data.totals.overtimeMinutes),
    earnings: money(data.totals.earningsCents),
    rate: rate(data.totals.earningsCents, data.totals.paidMinutes),
    expenses: money(data.totalExpensesCents),
    mileage: money(data.totalMileageCents),
  };

  const isTimeMetric = metric === "hours" || metric === "overtime" || metric === "earnings" || metric === "rate";
  const days = Math.round((Date.parse(`${data.range.end}T00:00:00Z`) - Date.parse(`${data.range.start}T00:00:00Z`)) / 86_400_000) + 1;
  const defaultGranularity: Granularity = days <= 31 ? "day" : days <= 120 ? "week" : "month";
  const granularity = fitGranularity(data.range.start, data.range.end, isGranularity(query.by) ? query.by : defaultGranularity);
  const buckets = isTimeMetric ? data.bucketTotals(granularity) : [];
  const label = (bucket: (typeof buckets)[number]) => formatBucketLabel(bucket, granularity, ctx.timezone, intl);

  const chartValue = (bucket: (typeof buckets)[number]) =>
    metric === "hours"
      ? bucket.paidMinutes
      : metric === "overtime"
        ? bucket.overtimeMinutes
        : metric === "earnings"
          ? bucket.earningsCents
          : (hourlyRateCents(bucket.earningsCents, bucket.paidMinutes) ?? 0);
  const chartFormat = metric === "hours" || metric === "overtime" ? hours : money;
  const jobRows = Object.entries(data.summaries).sort((a, b) => b[1].paidMinutes - a[1].paidMinutes);
  // Fewest-first rows read oddly for money; newest-first reads like a statement.
  const visibleBuckets = [...buckets].reverse().filter((b) => b.paidMinutes > 0 || granularity !== "day");

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/reports?${data.rangeQuery}`}
          className="print-hidden -ml-1 inline-flex min-h-11 items-center gap-0.5 rounded-full pr-3 text-[15px] text-primary"
        >
          <ChevronLeft className="size-5" aria-hidden="true" /> {m.reports.title}
        </Link>
        <h1 className="text-[28px] leading-tight font-bold tracking-tight md:text-3xl">{titles[metric]}</h1>
        <p className="text-sm text-muted-foreground">{rangeLabel}</p>
        <p className="mt-3 text-[40px] leading-none font-bold tracking-tight tabular-nums">{headline[metric]}</p>
        {(metric === "earnings" || metric === "rate") && <p className="mt-1 text-xs text-muted-foreground">{m.reports.beforeDeductions}</p>}
      </div>

      {isTimeMetric && (
        <>
          <Card>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-base">{fmt(m.reports.byPeriod, { metric: titles[metric] })}</CardTitle>
              <GranularityTabs
                basePath={`/reports/${metric}`}
                query={data.rangeQuery}
                current={granularity}
                labels={m.reports.granularity}
                label={fmt(m.reports.byPeriod, { metric: titles[metric] })}
              />
            </CardHeader>
            <CardContent className="space-y-4">
              {buckets.length <= 31 && (
                <TimeSeriesBarChart
                  data={buckets.map((bucket) => ({ label: label(bucket), values: { value: chartValue(bucket) } }))}
                  series={[{ key: "value", label: titles[metric], colorClassName: "bg-chart-1" }]}
                  formatValue={chartFormat}
                  formatAxisTick={chartFormat === money ? makeAxisFormatter({ kind: "money", currency: ctx.currency, intl }) : chartFormat}
                  emptyMessage={m.reports.noShifts}
                />
              )}
              <div className="-mx-5 sm:mx-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{m.reports.period}</TableHead>
                      <TableHead className="text-right">{m.reports.hoursShort}</TableHead>
                      <TableHead className="text-right">{m.common.overtime}</TableHead>
                      <TableHead className="text-right">{metric === "rate" ? m.reports.perHourShort : m.common.earnings}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleBuckets.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                          {m.reports.noShifts}
                        </TableCell>
                      </TableRow>
                    ) : (
                      visibleBuckets.map((bucket) => (
                        <TableRow key={bucket.startDate}>
                          <TableCell className="whitespace-nowrap">{label(bucket)}</TableCell>
                          <TableCell className={cn("text-right tabular-nums", metric === "hours" && "font-semibold")}>
                            {hours(bucket.paidMinutes)}
                          </TableCell>
                          <TableCell className={cn("text-right tabular-nums", metric === "overtime" && "font-semibold")}>
                            {hours(bucket.overtimeMinutes)}
                          </TableCell>
                          <TableCell className={cn("text-right tabular-nums", (metric === "earnings" || metric === "rate") && "font-semibold")}>
                            {metric === "rate" ? rate(bucket.earningsCents, bucket.paidMinutes) : money(bucket.earningsCents)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{m.reports.byJob}</CardTitle>
            </CardHeader>
            <CardContent>
              {jobRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">{m.reports.noShifts}</p>
              ) : (
                <ul className="divide-y divide-black/[0.06]">
                  {jobRows.map(([jobId, s]) => {
                    const job = data.jobsById.get(jobId);
                    return (
                      <li key={jobId} className="flex items-center gap-3 py-3">
                        <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: job?.color ?? "var(--chart-1)" }} aria-hidden="true" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{job?.name ?? m.common.unknownJob}</p>
                          <p className="text-xs text-muted-foreground">
                            {fmt(m.reports.jobLine, {
                              shifts: s.shiftCount,
                              hours: hours(s.paidMinutes),
                              overtime: hours(s.overtimeMinutes),
                              rate: rate(s.earningsCents, s.paidMinutes),
                            })}
                          </p>
                        </div>
                        <span className="shrink-0 font-semibold tabular-nums">{money(s.earningsCents)}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{m.reports.shiftsTitle}</CardTitle>
            </CardHeader>
            <CardContent>
              {data.inRangeShifts.length === 0 ? (
                <p className="text-sm text-muted-foreground">{m.reports.noShifts}</p>
              ) : (
                <ul className="divide-y divide-black/[0.06]">
                  {[...data.inRangeShifts].reverse().slice(0, 200).map((shift) => {
                    const job = data.jobsById.get(shift.job_id);
                    const { paidMinutes } = calculateShiftDuration({
                      start: shift.actual_start!,
                      end: shift.actual_end,
                      breaks: shift.breaks.map((b) => ({ startedAt: b.started_at, endedAt: b.ended_at, isPaid: b.is_paid })),
                    });
                    return (
                      <li key={shift.id} className="flex items-center gap-3 py-2.5 text-sm">
                        <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: job?.color ?? "var(--chart-1)" }} aria-hidden="true" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate">{job?.name ?? m.common.unknownJob}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatShortDate(shift.actual_start!, ctx.timezone, intl)} · {formatTime(shift.actual_start!, ctx.timezone, intl)}
                            {shift.actual_end && ` – ${formatTime(shift.actual_end, ctx.timezone, intl)}`}
                          </p>
                        </div>
                        <span className="shrink-0 tabular-nums">{hours(paidMinutes)}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
              <p className="mt-3 text-xs text-muted-foreground">{m.reports.overtimeNote}</p>
            </CardContent>
          </Card>
        </>
      )}

      {metric === "expenses" && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{m.reports.expensesByCategory}</CardTitle>
            </CardHeader>
            <CardContent>
              <CategoryBarChart
                data={(Object.keys(EXPENSE_CATEGORY_COLORS) as ExpenseCategory[]).map((category) => ({
                  label: m.expenses.categories[category],
                  value: data.expenses.filter((e) => e.category === category).reduce((sum, e) => sum + dollarsToCents(e.amount), 0),
                  color: EXPENSE_CATEGORY_COLORS[category],
                }))}
                formatValue={money}
                emptyMessage={m.reports.noExpenses}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{m.reports.allExpenses}</CardTitle>
            </CardHeader>
            <CardContent>
              {data.expenses.length === 0 ? (
                <p className="text-sm text-muted-foreground">{m.reports.noExpenses}</p>
              ) : (
                <ul className="divide-y divide-black/[0.06]">
                  {[...data.expenses].reverse().map((expense) => (
                    <li key={expense.id} className="flex items-center gap-3 py-2.5 text-sm">
                      <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: EXPENSE_CATEGORY_COLORS[expense.category] }} aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate">{expense.description || m.expenses.categories[expense.category]}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatCalendarDate(expense.expense_date, intl)} · {m.expenses.categories[expense.category]}
                          {expense.job_id && data.jobsById.get(expense.job_id) && ` · ${data.jobsById.get(expense.job_id)!.name}`}
                        </p>
                      </div>
                      {expense.receipt_url && <Paperclip className="size-3.5 shrink-0 text-muted-foreground" aria-label={m.expenses.hasReceipt} />}
                      <span className="shrink-0 font-medium tabular-nums">{money(dollarsToCents(expense.amount))}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {metric === "mileage" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{m.reports.allTrips}</CardTitle>
          </CardHeader>
          <CardContent>
            {data.mileage.length === 0 ? (
              <p className="text-sm text-muted-foreground">{m.reports.noTrips}</p>
            ) : (
              <>
                <p className="mb-2 text-sm text-muted-foreground">
                  {fmt(m.reports.tripsSummary, {
                    trips: data.mileage.length,
                    distance: data.mileage
                      .reduce((sum, t) => sum + t.distance, 0)
                      .toLocaleString(intl, { maximumFractionDigits: 1 }),
                    unit: data.mileage[0].unit,
                  })}
                </p>
                <ul className="divide-y divide-black/[0.06]">
                  {[...data.mileage].reverse().map((trip) => (
                    <li key={trip.id} className="flex items-center gap-3 py-2.5 text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="truncate">
                          {trip.start_location && trip.end_location ? `${trip.start_location} → ${trip.end_location}` : trip.notes || m.nav.mileage}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatCalendarDate(trip.date, intl)} · {trip.distance.toLocaleString(intl, { maximumFractionDigits: 1 })} {trip.unit}
                        </p>
                      </div>
                      <span className="shrink-0 font-medium tabular-nums">{money(dollarsToCents(trip.reimbursement))}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

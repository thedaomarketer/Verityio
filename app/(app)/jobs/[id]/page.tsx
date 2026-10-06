import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/data/context";
import { getCompletedShiftsInRange } from "@/lib/data/shifts";
import { formatCents, getLocalMonthBounds, getWorkweekBounds, summarizeRangeByJob } from "@/lib/calculations";
import { jobRatesFrom, shiftInputsFrom } from "@/lib/data/earnings";
import { formatMinutesAsHours } from "@/lib/format";
import { getI18n } from "@/lib/i18n/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EditJobDialog } from "@/components/jobs/edit-job-dialog";
import { ShiftHistoryTable } from "@/components/time/shift-history-table";

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [ctx, { locale, intl, m }] = await Promise.all([requireUserContext(), getI18n()]);
  if (!ctx) redirect("/login");

  const supabase = await createClient();
  const { data: job } = await supabase
    .from("jobs")
    .select("*")
    .eq("id", id)
    .eq("user_id", ctx.userId)
    .maybeSingle();

  if (!job) notFound();

  const { start, end } = getLocalMonthBounds(new Date(), ctx.timezone);
  // From the start of the workweek the month begins in, so those days count toward that week's overtime.
  const contextStart = getWorkweekBounds(start, ctx.timezone, ctx.weekStartsOn).start;
  const rangeShifts = await getCompletedShiftsInRange(ctx.userId, contextStart, end);
  const jobShifts = rangeShifts.filter((s) => s.job_id === job.id && s.actual_start && s.actual_start >= start.toISOString());

  const summary = summarizeRangeByJob(
    shiftInputsFrom(rangeShifts.filter((s) => s.job_id === job.id)),
    jobRatesFrom([job]),
    ctx.timezone,
    ctx.weekStartsOn,
    start,
    end
  )[job.id];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="size-4 rounded-full" style={{ backgroundColor: job.color }} />
          <div>
            <h1 className="text-[28px] leading-tight font-bold tracking-tight md:text-3xl">{job.name}</h1>
            {job.job_title && <p className="text-sm text-muted-foreground">{job.job_title}</p>}
          </div>
          {!job.is_active && <Badge variant="secondary">{m.jobs.archived}</Badge>}
        </div>
        <EditJobDialog job={job} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="gap-1.5">
          <CardHeader>
            <CardTitle className="text-sm font-normal text-muted-foreground">{m.common.thisMonth}</CardTitle>
          </CardHeader>
          <CardContent className="text-[26px] leading-tight font-bold tracking-tight">
            {formatMinutesAsHours(summary?.paidMinutes ?? 0, locale)}
          </CardContent>
        </Card>
        <Card className="gap-1.5">
          <CardHeader>
            <CardTitle className="text-sm font-normal text-muted-foreground">{m.common.overtime}</CardTitle>
          </CardHeader>
          <CardContent className="text-[26px] leading-tight font-bold tracking-tight">
            {formatMinutesAsHours(summary?.overtimeMinutes ?? 0, locale)}
          </CardContent>
        </Card>
        <Card className="gap-1.5">
          <CardHeader>
            <CardTitle className="text-sm font-normal text-muted-foreground">{m.common.earnings}</CardTitle>
          </CardHeader>
          <CardContent className="text-[26px] leading-tight font-bold tracking-tight">
            {formatCents(summary?.earningsCents ?? 0, ctx.currency, intl)}
          </CardContent>
        </Card>
      </div>

      {job.description && (
        <Card>
          <CardContent className="pt-6 text-sm whitespace-pre-wrap">{job.description}</CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{m.jobs.shiftsThisMonth}</CardTitle>
        </CardHeader>
        <CardContent className="px-0 sm:px-6">
          <ShiftHistoryTable
            shifts={jobShifts.map((s) => ({ ...s, job: s.job }))}
            jobs={[{ id: job.id, name: job.name }]}
            timezone={ctx.timezone}
            userId={ctx.userId}
          />
        </CardContent>
      </Card>
    </div>
  );
}

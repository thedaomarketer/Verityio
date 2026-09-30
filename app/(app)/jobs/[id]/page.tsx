import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/data/context";
import { getCompletedShiftsInRange } from "@/lib/data/shifts";
import {
  dollarsToCents,
  formatCents,
  getLocalMonthBounds,
  summarizeShiftsByJob,
} from "@/lib/calculations";
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
  const monthShifts = await getCompletedShiftsInRange(ctx.userId, start, end);
  const jobShifts = monthShifts.filter((s) => s.job_id === job.id);

  const summary = summarizeShiftsByJob(
    jobShifts
      .filter((s) => s.actual_start)
      .map((s) => ({
        jobId: s.job_id,
        start: s.actual_start!,
        end: s.actual_end,
        breaks: s.breaks.map((b) => ({ startedAt: b.started_at, endedAt: b.ended_at, isPaid: b.is_paid })),
      })),
    {
      [job.id]: {
        hourlyRateCents: job.hourly_rate ? dollarsToCents(job.hourly_rate) : 0,
        overtimeRateCents: job.overtime_rate ? dollarsToCents(job.overtime_rate) : null,
        overtimeThresholdMinutes: job.overtime_threshold_minutes,
      },
    }
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
          />
        </CardContent>
      </Card>
    </div>
  );
}

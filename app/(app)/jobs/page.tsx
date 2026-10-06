import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/data/context";
import { getCompletedShiftsInRange } from "@/lib/data/shifts";
import { dollarsToCents, formatCents, getWorkweekBounds, summarizeRangeByJob } from "@/lib/calculations";
import { jobRatesFrom, shiftInputsFrom } from "@/lib/data/earnings";
import { formatMinutesAsHours } from "@/lib/format";
import { fmt } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreateJobDialog } from "@/components/jobs/create-job-dialog";
import { JobActionsMenu } from "@/components/jobs/job-actions-menu";

export default async function JobsPage() {
  const [ctx, { locale, intl, m }] = await Promise.all([requireUserContext(), getI18n()]);
  if (!ctx) redirect("/login");

  const supabase = await createClient();
  const { data: jobs } = await supabase
    .from("jobs")
    .select("*")
    .eq("user_id", ctx.userId)
    .order("is_active", { ascending: false })
    .order("created_at", { ascending: false });

  const { start, end } = getWorkweekBounds(new Date(), ctx.timezone, ctx.weekStartsOn);
  const shifts = await getCompletedShiftsInRange(ctx.userId, start, end);

  // Overtime is weekly (and daily for some jobs): the fetch covers exactly this workweek.
  const summaries = summarizeRangeByJob(
    shiftInputsFrom(shifts),
    jobRatesFrom(jobs ?? []),
    ctx.timezone,
    ctx.weekStartsOn,
    start,
    end
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-[28px] leading-tight font-bold tracking-tight md:text-3xl">{m.jobs.title}</h1>
        <CreateJobDialog />
      </div>

      {!jobs || jobs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {m.jobs.empty}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {jobs.map((job) => {
            const summary = summaries[job.id];
            return (
              <Card key={job.id} className={!job.is_active ? "opacity-60" : undefined}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="size-3 rounded-full" style={{ backgroundColor: job.color }} />
                      <CardTitle className="text-base">
                        <Link href={`/jobs/${job.id}`} className="hover:underline">
                          {job.name}
                        </Link>
                      </CardTitle>
                    </div>
                    <JobActionsMenu jobId={job.id} isActive={job.is_active} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {job.job_title && <p className="text-sm text-muted-foreground">{job.job_title}</p>}
                  {job.hourly_rate != null && (
                    <p className="text-sm">
                      {fmt(m.jobs.perHour, { rate: formatCents(dollarsToCents(job.hourly_rate), ctx.currency, intl) })}
                    </p>
                  )}
                  <div className="flex items-center justify-between border-t pt-3 text-sm">
                    <span className="text-muted-foreground">{m.common.thisWeek}</span>
                    <span className="font-medium tabular-nums">
                      {formatMinutesAsHours(summary?.paidMinutes ?? 0, locale)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{m.common.earnings}</span>
                    <span className="font-medium tabular-nums">
                      {formatCents(summary?.earningsCents ?? 0, ctx.currency, intl)}
                    </span>
                  </div>
                  {!job.is_active && (
                    <Badge variant="secondary" className="w-fit">
                      {m.jobs.archived}
                    </Badge>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

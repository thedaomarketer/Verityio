import { dollarsToCents, type JobRateConfig, type ShiftSummaryInput } from "@/lib/calculations";

interface JobRateRow {
  id: string;
  hourly_rate: number | null;
  overtime_rate: number | null;
  overtime_threshold_minutes: number | null;
}

interface ShiftRow {
  job_id: string;
  actual_start: string | null;
  actual_end: string | null;
  breaks: { started_at: string; ended_at: string | null; is_paid: boolean }[];
}

/** Job rows -> the per-job rate config the calculation layer takes (cents, never floats). */
export function jobRatesFrom(jobs: JobRateRow[]): Record<string, JobRateConfig> {
  return Object.fromEntries(
    jobs.map((job) => [
      job.id,
      {
        hourlyRateCents: job.hourly_rate ? dollarsToCents(job.hourly_rate) : 0,
        overtimeRateCents: job.overtime_rate ? dollarsToCents(job.overtime_rate) : null,
        overtimeThresholdMinutes: job.overtime_threshold_minutes,
      },
    ])
  );
}

/** Shift rows (with breaks) -> calculation inputs; shifts that never started are skipped. */
export function shiftInputsFrom(shifts: ShiftRow[]): ShiftSummaryInput[] {
  return shifts
    .filter((s) => s.actual_start)
    .map((s) => ({
      jobId: s.job_id,
      start: s.actual_start!,
      end: s.actual_end,
      breaks: s.breaks.map((b) => ({ startedAt: b.started_at, endedAt: b.ended_at, isPaid: b.is_paid })),
    }));
}

import "server-only";

import type Anthropic from "@anthropic-ai/sdk";

import type { createClient } from "@/lib/supabase/server";
import {
  calculateShiftDuration,
  dollarsToCents,
  formatCents,
  getWorkweekBounds,
  localDateString,
  summarizeRangeByJob,
  sumJobSummaries,
  type JobRateConfig,
} from "@/lib/calculations";
import { jobRatesFrom, shiftInputsFrom } from "@/lib/data/earnings";
import { formatMinutesAsHours } from "@/lib/format";

import type { EntryType, ExpenseCategory } from "@/lib/supabase/database.types";
import { resolvePeriod, type Period } from "./period";

// Tool results are read by the model, not shown verbatim, so they use one
// fixed, unambiguous format; the model replies in the user's own language.
const hours = (minutes: number) => formatMinutesAsHours(minutes, "en");

/** The inclusive local calendar dates an instant range [start, end) covers, for `date` columns. */
function localDateBounds(start: Date, end: Date, timezone: string): { first: string; last: string } {
  return { first: localDateString(start, timezone), last: localDateString(new Date(end.getTime() - 1), timezone) };
}

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export interface ToolContext {
  supabase: SupabaseServerClient;
  userId: string;
  timezone: string;
  weekStartsOn: number;
  currency: string;
}

const periodProperty = {
  period: {
    type: "string",
    enum: ["today", "yesterday", "this_week", "last_week", "this_month", "last_month", "custom"],
    description:
      "Which range to look at. Use 'custom' with startDate/endDate for anything else (e.g. a specific pay period).",
  },
  startDate: {
    type: "string",
    description: "YYYY-MM-DD. Required when period is 'custom'.",
  },
  endDate: {
    type: "string",
    description: "YYYY-MM-DD, inclusive. Required when period is 'custom'.",
  },
  jobId: {
    type: "string",
    description: "Optional. Limit to one job, using the id from the job list in the system prompt.",
  },
} as const;

function periodArgs(input: Record<string, unknown>) {
  return {
    period: input.period as Period,
    custom:
      input.startDate || input.endDate
        ? { startDate: input.startDate as string | undefined, endDate: input.endDate as string | undefined }
        : undefined,
    jobId: input.jobId as string | undefined,
  };
}

async function fetchJobRates(ctx: ToolContext) {
  const { data: jobs } = await ctx.supabase
    .from("jobs")
    .select(
      "id, name, hourly_rate, overtime_rate, overtime_threshold_minutes, daily_overtime_threshold_minutes, double_time_threshold_minutes, double_time_rate"
    )
    .eq("user_id", ctx.userId);

  const jobRates = jobRatesFrom(jobs ?? []);
  const jobNames = Object.fromEntries((jobs ?? []).map((job) => [job.id, job.name]));

  return { jobRates, jobNames };
}

async function fetchShiftsInRange(ctx: ToolContext, start: Date, end: Date, jobId?: string) {
  let query = ctx.supabase
    .from("shifts")
    .select("*, breaks(*)")
    .eq("user_id", ctx.userId)
    .eq("status", "completed")
    .gte("actual_start", start.toISOString())
    .lt("actual_start", end.toISOString());

  if (jobId) query = query.eq("job_id", jobId);

  const { data } = await query;
  return data ?? [];
}

/**
 * Per-job totals for [start, end), with overtime split per workweek (and
 * per workday for jobs with daily overtime). Earlier shifts in the first
 * workweek count toward its thresholds, so they're fetched as context.
 */
async function summarize(
  ctx: ToolContext,
  shifts: Awaited<ReturnType<typeof fetchShiftsInRange>>,
  jobRates: Record<string, JobRateConfig>,
  start: Date,
  end: Date,
  jobId?: string
) {
  const contextStart = getWorkweekBounds(start, ctx.timezone, ctx.weekStartsOn).start;
  const earlier = contextStart < start ? await fetchShiftsInRange(ctx, contextStart, start, jobId) : [];
  return summarizeRangeByJob(shiftInputsFrom([...earlier, ...shifts]), jobRates, ctx.timezone, ctx.weekStartsOn, start, end);
}

export function buildTools(): Anthropic.Tool[] {
  return [
    {
      name: "get_hours",
      description:
        "Get regular, overtime, and total paid hours for a date range, computed from the user's recorded shifts. Optionally scoped to one job.",
      input_schema: { type: "object", properties: { ...periodProperty }, required: ["period"] },
    },
    {
      name: "get_overtime",
      description:
        "Get overtime hours specifically for a date range, broken down by job (each job's overtime threshold applies to that job's own hours).",
      input_schema: { type: "object", properties: { ...periodProperty }, required: ["period"] },
    },
    {
      name: "get_earnings",
      description:
        "Get estimated gross earnings (regular + overtime) for a date range, computed from recorded shifts and each job's hourly/overtime rate. This is always an estimate, not an actual payroll figure.",
      input_schema: { type: "object", properties: { ...periodProperty }, required: ["period"] },
    },
    {
      name: "get_shifts",
      description: "List individual recorded shifts in a date range, with computed paid duration for each.",
      input_schema: { type: "object", properties: { ...periodProperty }, required: ["period"] },
    },
    {
      name: "get_expenses",
      description: "List and total work expenses in a date range, optionally filtered by category.",
      input_schema: {
        type: "object",
        properties: {
          ...periodProperty,
          category: {
            type: "string",
            enum: ["meals", "transport", "supplies", "equipment", "lodging", "other"],
          },
        },
        required: ["period"],
      },
    },
    {
      name: "get_mileage",
      description: "List and total work mileage/trips logged in a date range.",
      input_schema: { type: "object", properties: { ...periodProperty }, required: ["period"] },
    },
    {
      name: "get_schedule",
      description: "List upcoming scheduled shifts and calendar entries from today onward.",
      input_schema: {
        type: "object",
        properties: { daysAhead: { type: "number", description: "How many days ahead to look. Default 14." } },
      },
    },
    {
      name: "get_journal_entries",
      description: "List work journal entries (notes, tasks, incidents, etc.) in a date range.",
      input_schema: {
        type: "object",
        properties: {
          ...periodProperty,
          entryType: {
            type: "string",
            enum: [
              "general",
              "task",
              "instruction",
              "workplace_issue",
              "safety_issue",
              "schedule_change",
              "pay_issue",
              "break_issue",
              "incident",
              "other",
            ],
          },
        },
        required: ["period"],
      },
    },
    {
      name: "generate_report",
      description:
        "Generate a full summary report for a date range: hours, overtime, earnings, expenses, and mileage together. Use this for broad questions like 'summarize my month' instead of calling every tool individually.",
      input_schema: { type: "object", properties: { ...periodProperty }, required: ["period"] },
    },
  ];
}

export function buildToolHandlers(
  ctx: ToolContext
): Record<string, (input: Record<string, unknown>) => Promise<unknown>> {
  const periodCtx = { timezone: ctx.timezone, weekStartsOn: ctx.weekStartsOn, now: new Date() };

  return {
    async get_hours(input) {
      const { period, custom, jobId } = periodArgs(input);
      const { start, end, label } = resolvePeriod(period, periodCtx, custom);
      const { jobRates, jobNames } = await fetchJobRates(ctx);
      const shifts = await fetchShiftsInRange(ctx, start, end, jobId);
      const summary = await summarize(ctx, shifts, jobRates, start, end, jobId);
      const totals = sumJobSummaries(summary);

      return {
        range: label,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        totalPaidHours: hours(totals.paidMinutes),
        regularHours: hours(totals.regularMinutes),
        overtimeHours: hours(totals.overtimeMinutes),
        byJob: Object.fromEntries(
          Object.entries(summary).map(([id, s]) => [
            jobNames[id] ?? id,
            {
              paidHours: hours(s.paidMinutes),
              regularHours: hours(s.regularMinutes),
              overtimeHours: hours(s.overtimeMinutes),
              shiftCount: s.shiftCount,
            },
          ])
        ),
        note: "Computed from recorded (completed) shifts only. Any shift you're still clocked into is not included.",
      };
    },

    async get_overtime(input) {
      const { period, custom, jobId } = periodArgs(input);
      const { start, end, label } = resolvePeriod(period, periodCtx, custom);
      const { jobRates, jobNames } = await fetchJobRates(ctx);
      const shifts = await fetchShiftsInRange(ctx, start, end, jobId);
      const summary = await summarize(ctx, shifts, jobRates, start, end, jobId);

      const byJob = Object.fromEntries(
        Object.entries(summary)
          .filter(([, s]) => s.overtimeMinutes > 0)
          .map(([id, s]) => [jobNames[id] ?? id, hours(s.overtimeMinutes)])
      );

      return {
        range: label,
        totalOvertimeHours: hours(sumJobSummaries(summary).overtimeMinutes),
        byJob,
        note: "Overtime is calculated per job against that job's own configured overtime threshold, using only recorded shifts.",
      };
    },

    async get_earnings(input) {
      const { period, custom, jobId } = periodArgs(input);
      const { start, end, label } = resolvePeriod(period, periodCtx, custom);
      const { jobRates, jobNames } = await fetchJobRates(ctx);
      const shifts = await fetchShiftsInRange(ctx, start, end, jobId);
      const summary = await summarize(ctx, shifts, jobRates, start, end, jobId);
      const totals = sumJobSummaries(summary);

      return {
        range: label,
        estimatedGrossEarnings: formatCents(totals.earningsCents, ctx.currency, "en-US"),
        regularHours: hours(totals.regularMinutes),
        overtimeHours: hours(totals.overtimeMinutes),
        byJob: Object.fromEntries(
          Object.entries(summary).map(([id, s]) => [jobNames[id] ?? id, formatCents(s.earningsCents, ctx.currency, "en-US")])
        ),
        note:
          "This is a gross estimate based on recorded shifts and each job's configured rate. It does not represent an actual payroll deposit, and does not account for taxes or deductions.",
      };
    },

    async get_shifts(input) {
      const { period, custom, jobId } = periodArgs(input);
      const { start, end, label } = resolvePeriod(period, periodCtx, custom);
      const { jobNames } = await fetchJobRates(ctx);
      const shifts = await fetchShiftsInRange(ctx, start, end, jobId);

      return {
        range: label,
        shifts: shifts.map((s) => {
          const result = calculateShiftDuration({
            start: s.actual_start!,
            end: s.actual_end,
            breaks: s.breaks.map((b) => ({ startedAt: b.started_at, endedAt: b.ended_at, isPaid: b.is_paid })),
          });
          return {
            job: jobNames[s.job_id] ?? s.job_id,
            start: s.actual_start,
            end: s.actual_end,
            paidHours: hours(result.paidMinutes),
            notes: s.notes,
          };
        }),
      };
    },

    async get_expenses(input) {
      const { period, custom, jobId } = periodArgs(input);
      const { start, end, label } = resolvePeriod(period, periodCtx, custom);
      const category = input.category as ExpenseCategory | undefined;

      const dates = localDateBounds(start, end, ctx.timezone);
      let query = ctx.supabase
        .from("expenses")
        .select("*, job:jobs(name)")
        .eq("user_id", ctx.userId)
        .gte("expense_date", dates.first)
        .lte("expense_date", dates.last);
      if (jobId) query = query.eq("job_id", jobId);
      if (category) query = query.eq("category", category);

      const { data } = await query;
      const totalCents = (data ?? []).reduce((sum, e) => sum + dollarsToCents(e.amount), 0);

      return {
        range: label,
        total: formatCents(totalCents, ctx.currency, "en-US"),
        count: data?.length ?? 0,
        expenses: (data ?? []).map((e) => ({
          date: e.expense_date,
          amount: formatCents(dollarsToCents(e.amount), e.currency, "en-US"),
          category: e.category,
          job: e.job?.name ?? null,
          description: e.description,
        })),
      };
    },

    async get_mileage(input) {
      const { period, custom, jobId } = periodArgs(input);
      const { start, end, label } = resolvePeriod(period, periodCtx, custom);

      const dates = localDateBounds(start, end, ctx.timezone);
      let query = ctx.supabase
        .from("mileage_entries")
        .select("*, job:jobs(name)")
        .eq("user_id", ctx.userId)
        .gte("date", dates.first)
        .lte("date", dates.last);
      if (jobId) query = query.eq("job_id", jobId);

      const { data } = await query;
      const totalReimbursementCents = (data ?? []).reduce((sum, m) => sum + dollarsToCents(m.reimbursement), 0);
      const totalDistance = (data ?? []).reduce((sum, m) => sum + m.distance, 0);

      return {
        range: label,
        totalReimbursement: formatCents(totalReimbursementCents, ctx.currency, "en-US"),
        totalDistance,
        trips: (data ?? []).map((m) => ({
          date: m.date,
          from: m.start_location,
          to: m.end_location,
          distance: `${m.distance} ${m.unit}`,
          reimbursement: formatCents(dollarsToCents(m.reimbursement), ctx.currency, "en-US"),
          job: m.job?.name ?? null,
        })),
      };
    },

    async get_schedule(input) {
      const daysAhead = typeof input.daysAhead === "number" ? input.daysAhead : 14;
      const now = new Date();
      const until = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

      const [{ data: shifts }, { data: scheduleEntries }] = await Promise.all([
        ctx.supabase
          .from("shifts")
          .select("*, job:jobs(name)")
          .eq("user_id", ctx.userId)
          .eq("status", "scheduled")
          .gte("scheduled_start", now.toISOString())
          .lte("scheduled_start", until.toISOString())
          .order("scheduled_start"),
        ctx.supabase
          .from("schedule_entries")
          .select("*, job:jobs(name)")
          .eq("user_id", ctx.userId)
          .gte("start_at", now.toISOString())
          .lte("start_at", until.toISOString())
          .order("start_at"),
      ]);

      return {
        upcomingShifts: (shifts ?? []).map((s) => ({
          job: s.job?.name ?? null,
          start: s.scheduled_start,
          end: s.scheduled_end,
        })),
        upcomingScheduleEntries: (scheduleEntries ?? []).map((s) => ({
          job: s.job?.name ?? null,
          start: s.start_at,
          end: s.end_at,
          status: s.status,
          notes: s.notes,
        })),
      };
    },

    async get_journal_entries(input) {
      const { period, custom } = periodArgs(input);
      const { start, end, label } = resolvePeriod(period, periodCtx, custom);
      const entryType = input.entryType as EntryType | undefined;

      let query = ctx.supabase
        .from("journal_entries")
        .select("*, job:jobs(name)")
        .eq("user_id", ctx.userId)
        .gte("event_at", start.toISOString())
        .lt("event_at", end.toISOString())
        .order("event_at", { ascending: false });
      if (entryType) query = query.eq("entry_type", entryType);

      const { data } = await query;

      return {
        range: label,
        entries: (data ?? []).map((e) => ({
          type: e.entry_type,
          title: e.title,
          content: e.content,
          at: e.event_at,
          job: e.job?.name ?? null,
        })),
      };
    },

    async generate_report(input) {
      const { period, custom, jobId } = periodArgs(input);
      const { start, end, label } = resolvePeriod(period, periodCtx, custom);
      const { jobRates, jobNames } = await fetchJobRates(ctx);
      const dates = localDateBounds(start, end, ctx.timezone);

      const [shifts, expensesRes, mileageRes] = await Promise.all([
        fetchShiftsInRange(ctx, start, end, jobId),
        ctx.supabase
          .from("expenses")
          .select("amount, currency")
          .eq("user_id", ctx.userId)
          .gte("expense_date", dates.first)
          .lte("expense_date", dates.last),
        ctx.supabase
          .from("mileage_entries")
          .select("reimbursement")
          .eq("user_id", ctx.userId)
          .gte("date", dates.first)
          .lte("date", dates.last),
      ]);

      const summary = await summarize(ctx, shifts, jobRates, start, end, jobId);
      const totals = sumJobSummaries(summary);
      const totalExpensesCents = (expensesRes.data ?? []).reduce((sum, e) => sum + dollarsToCents(e.amount), 0);
      const totalMileageCents = (mileageRes.data ?? []).reduce((sum, m) => sum + dollarsToCents(m.reimbursement), 0);

      return {
        range: label,
        hours: {
          total: hours(totals.paidMinutes),
          regular: hours(totals.regularMinutes),
          overtime: hours(totals.overtimeMinutes),
        },
        estimatedGrossEarnings: formatCents(totals.earningsCents, ctx.currency, "en-US"),
        totalExpenses: formatCents(totalExpensesCents, ctx.currency, "en-US"),
        totalMileageReimbursement: formatCents(totalMileageCents, ctx.currency, "en-US"),
        byJob: Object.fromEntries(
          Object.entries(summary).map(([id, s]) => [
            jobNames[id] ?? id,
            { paidHours: hours(s.paidMinutes), earnings: formatCents(s.earningsCents, ctx.currency, "en-US") },
          ])
        ),
        note: "Earnings figures are gross estimates from recorded shifts and configured rates, before taxes or deductions.",
      };
    },
  };
}

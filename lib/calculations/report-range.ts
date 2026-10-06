import { addDaysToDateString, addMonthsToMonthString, isDateString } from "./local-time";

/**
 * The Reports page's date range, as inclusive local calendar dates. Every
 * plan can pick any dates; the free plan covers up to three months at a
 * time (longer ranges are Plus) so anyone can still pull up any pay period,
 * month or quarter of their own records.
 */
export const REPORT_PRESETS = ["week", "month", "lastMonth", "last3Months", "year"] as const;
export type ReportPreset = (typeof REPORT_PRESETS)[number];
export const FREE_REPORT_PRESETS: readonly ReportPreset[] = ["week", "month", "lastMonth", "last3Months"];

/** Longest free range: three calendar months is at most 92 days, i.e. 91 days after the start. */
export const FREE_RANGE_MAX_DAYS = 91;

/** Longest custom range, so one request can't ask for decades of shifts. */
export const MAX_CUSTOM_RANGE_DAYS = 731;

export interface ReportRange {
  start: string;
  end: string;
  preset: ReportPreset | "custom";
  /** True when the request asked for a longer range than the plan includes and got a shorter one. */
  locked: boolean;
}

function monthEnd(month: string): string {
  return addDaysToDateString(`${addMonthsToMonthString(month, 1)}-01`, -1);
}

function daysBetween(start: string, end: string): number {
  return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000);
}

export function isReportPreset(value: unknown): value is ReportPreset {
  return typeof value === "string" && (REPORT_PRESETS as readonly string[]).includes(value);
}

/** `today` and `weekStart` are local dates (YYYY-MM-DD) in the user's time zone. */
export function presetRange(preset: ReportPreset, today: string, weekStart: string): { start: string; end: string } {
  const month = today.slice(0, 7);
  switch (preset) {
    case "week":
      return { start: weekStart, end: addDaysToDateString(weekStart, 6) };
    case "month":
      return { start: `${month}-01`, end: monthEnd(month) };
    case "lastMonth": {
      const last = addMonthsToMonthString(month, -1);
      return { start: `${last}-01`, end: monthEnd(last) };
    }
    case "last3Months":
      return { start: `${addMonthsToMonthString(month, -2)}-01`, end: monthEnd(month) };
    case "year":
      return { start: `${today.slice(0, 4)}-01-01`, end: `${today.slice(0, 4)}-12-31` };
  }
}

export function resolveReportRange(
  params: { range?: string; start?: string; end?: string },
  { today, weekStart, premium }: { today: string; weekStart: string; premium: boolean }
): ReportRange {
  const fallback = (locked: boolean): ReportRange => ({ ...presetRange("month", today, weekStart), preset: "month", locked });

  if (params.start && params.end && isDateString(params.start) && isDateString(params.end)) {
    const [start, end] = params.start <= params.end ? [params.start, params.end] : [params.end, params.start];
    const maxDays = premium ? MAX_CUSTOM_RANGE_DAYS : FREE_RANGE_MAX_DAYS;
    const tooLong = daysBetween(start, end) > maxDays;
    return {
      start,
      end: tooLong ? addDaysToDateString(start, maxDays) : end,
      preset: "custom",
      // Only the free plan's limit is an upsell; Plus's cap just guards the server.
      locked: tooLong && !premium,
    };
  }

  if (isReportPreset(params.range)) {
    if (!premium && !FREE_REPORT_PRESETS.includes(params.range)) {
      return { ...presetRange("last3Months", today, weekStart), preset: "last3Months", locked: true };
    }
    return { ...presetRange(params.range, today, weekStart), preset: params.range, locked: false };
  }

  return fallback(false);
}

import { addDaysToDateString, addMonthsToMonthString, isDateString } from "./local-time";

/**
 * The Reports page's date range, as inclusive local calendar dates. Free
 * plans get the short presets; longer presets and custom ranges are Premium.
 */
export const REPORT_PRESETS = ["week", "month", "lastMonth", "last3Months", "year"] as const;
export type ReportPreset = (typeof REPORT_PRESETS)[number];
export const FREE_REPORT_PRESETS: readonly ReportPreset[] = ["week", "month", "lastMonth"];

/** Longest custom range, so one request can't ask for decades of shifts. */
export const MAX_CUSTOM_RANGE_DAYS = 731;

export interface ReportRange {
  start: string;
  end: string;
  preset: ReportPreset | "custom";
  /** True when the request asked for a Premium range and got the default instead. */
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
    if (!premium) return fallback(true);
    const [start, end] = params.start <= params.end ? [params.start, params.end] : [params.end, params.start];
    const cappedEnd = daysBetween(start, end) > MAX_CUSTOM_RANGE_DAYS ? addDaysToDateString(start, MAX_CUSTOM_RANGE_DAYS) : end;
    return { start, end: cappedEnd, preset: "custom", locked: false };
  }

  if (isReportPreset(params.range)) {
    if (!premium && !FREE_REPORT_PRESETS.includes(params.range)) return fallback(true);
    return { ...presetRange(params.range, today, weekStart), preset: params.range, locked: false };
  }

  return fallback(false);
}

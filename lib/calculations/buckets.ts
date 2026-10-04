import { addDaysToDateString, addMonthsToMonthString, localDateString, localDayStart } from "./local-time";
import { getWorkweekBounds } from "./workweek";

export const GRANULARITIES = ["day", "week", "month", "year"] as const;
export type Granularity = (typeof GRANULARITIES)[number];

export function isGranularity(value: unknown): value is Granularity {
  return typeof value === "string" && (GRANULARITIES as readonly string[]).includes(value);
}

export interface PeriodBucket {
  /** First local date in the bucket (clipped to the range), YYYY-MM-DD. */
  startDate: string;
  /** Last local date in the bucket (clipped to the range), inclusive. */
  endDate: string;
  /** [start, end) instants for querying shifts. */
  start: Date;
  end: Date;
}

/** Most buckets one breakdown will produce; past this, a coarser granularity is used. */
export const MAX_BUCKETS = 120;

/**
 * Splits an inclusive local-date range into day / workweek / calendar-month /
 * calendar-year buckets in the user's time zone, clipping the first and last
 * to the range. Boundaries are local midnights, so DST changes never shift a
 * day into the wrong bucket.
 */
export function periodBuckets(
  startDate: string,
  endDate: string,
  granularity: Granularity,
  timezone: string,
  weekStartsOn: number
): PeriodBucket[] {
  if (endDate < startDate) return [];
  const buckets: PeriodBucket[] = [];
  let cursor = startDate;

  while (cursor <= endDate && buckets.length < MAX_BUCKETS) {
    let next: string;
    if (granularity === "day") {
      next = addDaysToDateString(cursor, 1);
    } else if (granularity === "week") {
      const weekEnd = getWorkweekBounds(localDayStart(cursor, timezone), timezone, weekStartsOn).end;
      next = localDateString(weekEnd, timezone);
    } else if (granularity === "month") {
      next = `${addMonthsToMonthString(cursor.slice(0, 7), 1)}-01`;
    } else {
      next = `${Number(cursor.slice(0, 4)) + 1}-01-01`;
    }

    const lastDay = addDaysToDateString(next, -1) < endDate ? addDaysToDateString(next, -1) : endDate;
    buckets.push({
      startDate: cursor,
      endDate: lastDay,
      start: localDayStart(cursor, timezone),
      end: localDayStart(addDaysToDateString(lastDay, 1), timezone),
    });
    cursor = next;
  }

  return buckets;
}

/** The finest granularity that keeps a range within `MAX_BUCKETS` (day -> week -> month -> year). */
export function fitGranularity(startDate: string, endDate: string, wanted: Granularity): Granularity {
  const days = Math.round((Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86_400_000) + 1;
  const approxBuckets: Record<Granularity, number> = { day: days, week: Math.ceil(days / 7) + 1, month: Math.ceil(days / 28) + 1, year: Math.ceil(days / 365) + 1 };
  const order = GRANULARITIES.slice(GRANULARITIES.indexOf(wanted));
  return order.find((g) => approxBuckets[g] <= MAX_BUCKETS) ?? "year";
}

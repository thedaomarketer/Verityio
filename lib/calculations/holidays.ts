/**
 * Public holidays (data from Nager.Date, fetched in lib/holidays/nager.ts).
 * Holidays are calendar dates ("yyyy-mm-dd") in the jurisdiction's own
 * calendar, so they're compared against a shift's *local* date in the
 * user's time zone -- never against a UTC date.
 */

export interface PublicHoliday {
  /** yyyy-mm-dd */
  date: string;
  /** English name, e.g. "Canada Day". */
  name: string;
  /** Name in the country's local language, e.g. "Fête du Canada" for some Canadian entries. */
  localName: string;
  countryCode: string;
  /** True when it applies country-wide. */
  global: boolean;
  /** ISO 3166-2 subdivisions it applies to when not global, e.g. ["CA-ON", "CA-BC"]. */
  counties: string[] | null;
  /** Nager.Date types: "Public", "Bank", "School", "Authorities", "Optional", "Observance". */
  types: string[];
}

/** Types that mean a day off (or holiday pay) for many workers. */
const WORK_HOLIDAY_TYPES = new Set(["Public", "Bank"]);

/**
 * The holidays that apply in `country` + `region` (a province/state code as
 * saved in tax settings, e.g. "ON" or "CA"): country-wide ones plus those
 * listing the region. Pure observances (e.g. Mother's Day) are dropped.
 */
export function holidaysForRegion(holidays: PublicHoliday[], country: string, region: string | null): PublicHoliday[] {
  const subdivision = region ? `${country}-${region}` : null;
  return holidays
    .filter((h) => h.countryCode === country)
    .filter((h) => h.types.length === 0 || h.types.some((t) => WORK_HOLIDAY_TYPES.has(t)))
    .filter((h) => h.global || (subdivision !== null && (h.counties ?? []).includes(subdivision)))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Holidays keyed by date; if two fall on one date the first (alphabetical by name) wins. */
export function holidaysByDate(holidays: PublicHoliday[]): Map<string, PublicHoliday> {
  const map = new Map<string, PublicHoliday>();
  for (const h of [...holidays].sort((a, b) => a.name.localeCompare(b.name))) {
    if (!map.has(h.date)) map.set(h.date, h);
  }
  return map;
}

/** Every calendar year touched by an inclusive yyyy-mm-dd range. */
export function yearsInRange(startDate: string, endDate: string): number[] {
  const first = Number(startDate.slice(0, 4));
  const last = Number(endDate.slice(0, 4));
  const years: number[] = [];
  for (let y = first; y <= last; y++) years.push(y);
  return years;
}

/** Holidays from `today` (inclusive) through `today + withinDays`, soonest first. */
export function upcomingHolidays(holidays: PublicHoliday[], today: string, withinDays: number): PublicHoliday[] {
  const [y, m, d] = today.split("-").map(Number);
  const limit = new Date(Date.UTC(y, m - 1, d + withinDays)).toISOString().slice(0, 10);
  return holidays.filter((h) => h.date >= today && h.date <= limit).sort((a, b) => a.date.localeCompare(b.date));
}

/** The name to show: English for English speakers, the local name otherwise. */
export function holidayDisplayName(holiday: PublicHoliday, locale: string): string {
  return locale === "en" ? holiday.name : holiday.localName || holiday.name;
}

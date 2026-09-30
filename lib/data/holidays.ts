import "server-only";

import { holidaysByDate, holidaysForRegion, type PublicHoliday } from "@/lib/calculations/holidays";
import { fetchPublicHolidays, type HolidayCountry } from "@/lib/holidays/nager";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export interface HolidayRegion {
  country: HolidayCountry;
  /** Province/state code, e.g. "ON"; null means country-wide holidays only. */
  region: string | null;
}

/**
 * Where the user works, for holiday purposes: the province/state saved under
 * Pay & Taxes. Null when no country is set -- the UI then offers a hint
 * rather than guessing.
 */
export async function getHolidayRegion(supabase: Supabase, userId: string): Promise<HolidayRegion | null> {
  const { data } = await supabase
    .from("user_settings")
    .select("tax_country, tax_region")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data?.tax_country) return null;
  return { country: data.tax_country, region: data.tax_region };
}

/** The region's public holidays for the given years, soonest first. */
export async function getRegionHolidays(region: HolidayRegion, years: number[]): Promise<PublicHoliday[]> {
  const unique = [...new Set(years)].slice(0, 5);
  const lists = await Promise.all(unique.map((year) => fetchPublicHolidays(year, region.country)));
  return holidaysForRegion(lists.flat(), region.country, region.region);
}

/** Convenience: the region's holidays keyed by yyyy-mm-dd (empty when no region is set). */
export async function getHolidayLookup(
  supabase: Supabase,
  userId: string,
  years: number[]
): Promise<Map<string, PublicHoliday>> {
  const region = await getHolidayRegion(supabase, userId);
  if (!region) return new Map();
  return holidaysByDate(await getRegionHolidays(region, years));
}

import "server-only";

import { z } from "zod";

import type { PublicHoliday } from "@/lib/calculations/holidays";

/** Countries Verity has regions for (the same set as tax jurisdictions). */
export type HolidayCountry = "CA" | "US";

const NAGER_BASE_URL = "https://date.nager.at/api/v3";
/** Holiday lists change rarely; refresh weekly in Next's data cache. */
const REVALIDATE_SECONDS = 7 * 24 * 60 * 60;
const TIMEOUT_MS = 4000;

const responseSchema = z.array(
  z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    localName: z.string().max(200),
    name: z.string().max(200),
    countryCode: z.string().length(2),
    global: z.boolean(),
    counties: z.array(z.string().max(20)).nullable().optional(),
    types: z.array(z.string().max(40)).optional(),
  })
);

/**
 * Public holidays for one country and year from Nager.Date (free, no key).
 * Fails soft: a slow, down, or malformed API returns [] so a page never
 * breaks because of it -- holidays are a nice-to-have, not a record.
 */
export async function fetchPublicHolidays(year: number, country: HolidayCountry): Promise<PublicHoliday[]> {
  if (!Number.isInteger(year) || year < 1990 || year > 2100) return [];

  try {
    const response = await fetch(`${NAGER_BASE_URL}/PublicHolidays/${year}/${country}`, {
      next: { revalidate: REVALIDATE_SECONDS, tags: ["public-holidays"] },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      console.warn(`Nager.Date returned ${response.status} for ${country} ${year}`);
      return [];
    }

    const parsed = responseSchema.safeParse(await response.json());
    if (!parsed.success) {
      console.warn(`Unexpected Nager.Date response for ${country} ${year}`);
      return [];
    }

    return parsed.data.map((h) => ({
      date: h.date,
      name: h.name,
      localName: h.localName,
      countryCode: h.countryCode,
      global: h.global,
      counties: h.counties ?? null,
      types: h.types ?? [],
    }));
  } catch (error) {
    console.warn(`Couldn't load public holidays for ${country} ${year}`, error);
    return [];
  }
}

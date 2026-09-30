import { describe, expect, it } from "vitest";

import {
  holidayDisplayName,
  holidaysByDate,
  holidaysForRegion,
  upcomingHolidays,
  yearsInRange,
  type PublicHoliday,
} from "@/lib/calculations/holidays";

function h(partial: Partial<PublicHoliday> & Pick<PublicHoliday, "date" | "name">): PublicHoliday {
  return { localName: partial.name, countryCode: "CA", global: true, counties: null, types: ["Public"], ...partial };
}

const CA_2024: PublicHoliday[] = [
  h({ date: "2024-07-01", name: "Canada Day", localName: "Fête du Canada" }),
  h({ date: "2024-08-05", name: "Civic Holiday", global: false, counties: ["CA-ON", "CA-BC"] }),
  h({ date: "2024-06-24", name: "Saint-Jean-Baptiste Day", localName: "Fête nationale du Québec", global: false, counties: ["CA-QC"] }),
  h({ date: "2024-05-12", name: "Mother's Day", types: ["Observance"] }),
];

describe("holidaysForRegion", () => {
  it("keeps country-wide holidays plus the region's own, sorted by date", () => {
    expect(holidaysForRegion(CA_2024, "CA", "QC").map((x) => x.name)).toEqual([
      "Saint-Jean-Baptiste Day",
      "Canada Day",
    ]);
    expect(holidaysForRegion(CA_2024, "CA", "ON").map((x) => x.name)).toEqual(["Canada Day", "Civic Holiday"]);
  });

  it("drops observances that aren't days off", () => {
    expect(holidaysForRegion(CA_2024, "CA", "ON").some((x) => x.name === "Mother's Day")).toBe(false);
  });

  it("only returns country-wide holidays when no region is set", () => {
    expect(holidaysForRegion(CA_2024, "CA", null).map((x) => x.name)).toEqual(["Canada Day"]);
  });

  it("ignores another country's entries", () => {
    expect(holidaysForRegion(CA_2024, "US", "CA")).toEqual([]);
  });
});

describe("helpers", () => {
  it("indexes holidays by date", () => {
    expect(holidaysByDate(CA_2024).get("2024-07-01")?.name).toBe("Canada Day");
    expect(holidaysByDate(CA_2024).get("2024-07-02")).toBeUndefined();
  });

  it("lists every year a range touches", () => {
    expect(yearsInRange("2024-12-20", "2025-01-10")).toEqual([2024, 2025]);
    expect(yearsInRange("2024-03-01", "2024-03-31")).toEqual([2024]);
  });

  it("finds upcoming holidays within a window, across a month end", () => {
    const list = holidaysForRegion(CA_2024, "CA", "ON");
    expect(upcomingHolidays(list, "2024-06-15", 30).map((x) => x.date)).toEqual(["2024-07-01"]);
    expect(upcomingHolidays(list, "2024-07-01", 0).map((x) => x.date)).toEqual(["2024-07-01"]);
    expect(upcomingHolidays(list, "2024-07-02", 30)).toEqual([]);
  });

  it("shows the English name in English and the local name otherwise", () => {
    const quebec = CA_2024[2];
    expect(holidayDisplayName(quebec, "en")).toBe("Saint-Jean-Baptiste Day");
    expect(holidayDisplayName(quebec, "fr")).toBe("Fête nationale du Québec");
  });
});

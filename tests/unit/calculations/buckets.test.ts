import { describe, expect, it } from "vitest";

import { fitGranularity, periodBuckets } from "@/lib/calculations/buckets";

const TZ = "America/Toronto";

describe("periodBuckets", () => {
  it("makes one bucket per day, inclusive", () => {
    const days = periodBuckets("2026-10-01", "2026-10-03", "day", TZ, 1);
    expect(days.map((b) => b.startDate)).toEqual(["2026-10-01", "2026-10-02", "2026-10-03"]);
    expect(days[0].start.toISOString()).toBe("2026-10-01T04:00:00.000Z");
    expect(days[0].end.toISOString()).toBe("2026-10-02T04:00:00.000Z");
  });

  it("clips workweeks to the range", () => {
    // Oct 1 2026 is a Thursday; Monday-start weeks.
    const weeks = periodBuckets("2026-10-01", "2026-10-14", "week", TZ, 1);
    expect(weeks.map((b) => [b.startDate, b.endDate])).toEqual([
      ["2026-10-01", "2026-10-04"],
      ["2026-10-05", "2026-10-11"],
      ["2026-10-12", "2026-10-14"],
    ]);
  });

  it("follows calendar months and years", () => {
    expect(periodBuckets("2026-01-15", "2026-03-10", "month", TZ, 1).map((b) => [b.startDate, b.endDate])).toEqual([
      ["2026-01-15", "2026-01-31"],
      ["2026-02-01", "2026-02-28"],
      ["2026-03-01", "2026-03-10"],
    ]);
    expect(periodBuckets("2025-12-01", "2026-02-01", "year", TZ, 1).map((b) => b.startDate)).toEqual(["2025-12-01", "2026-01-01"]);
  });

  it("keeps local midnights across a DST change", () => {
    // Clocks go back on Nov 1 2026 in Toronto: that day is 25 hours long.
    const [nov1] = periodBuckets("2026-11-01", "2026-11-01", "day", TZ, 1);
    expect(nov1.end.getTime() - nov1.start.getTime()).toBe(25 * 3_600_000);
  });

  it("returns nothing for a reversed range", () => {
    expect(periodBuckets("2026-10-02", "2026-10-01", "day", TZ, 1)).toEqual([]);
  });
});

describe("fitGranularity", () => {
  it("keeps the wanted granularity when it fits and coarsens when it doesn't", () => {
    expect(fitGranularity("2026-10-01", "2026-10-31", "day")).toBe("day");
    expect(fitGranularity("2026-01-01", "2026-12-31", "day")).toBe("week");
    expect(fitGranularity("2026-01-01", "2026-12-31", "month")).toBe("month");
  });
});

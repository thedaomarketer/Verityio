import { describe, expect, it } from "vitest";

import { summarizeRangeByJob } from "@/lib/calculations/range-summary";
import { summarizeShiftsByJob, type JobRateConfig, type ShiftSummaryInput } from "@/lib/calculations/summary";

const TZ = "America/Toronto";
const MONDAY = 1;
// $20/h, $30/h overtime after 40h a week.
const RATES: Record<string, JobRateConfig> = {
  job: { hourlyRateCents: 2000, overtimeRateCents: 3000, overtimeThresholdMinutes: 2400 },
};

/** An 8-hour shift starting at 09:00 Toronto time (13:00 UTC in October, EDT). */
function shift(date: string, hours = 8, jobId = "job"): ShiftSummaryInput {
  const start = new Date(`${date}T13:00:00Z`);
  return { jobId, start, end: new Date(start.getTime() + hours * 3_600_000), breaks: [] };
}

const weekdays = (dates: string[], hours = 8) => dates.map((d) => shift(d, hours));
// Mon Oct 5 - Fri Oct 9 and Mon Oct 12 - Fri Oct 16, 2026: 80 hours over two weeks.
const twoWeeks = weekdays([
  "2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09",
  "2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16",
]);

describe("summarizeRangeByJob", () => {
  it("doesn't call a normal fortnight overtime (the bug in summing first)", () => {
    const start = new Date("2026-10-05T04:00:00Z");
    const end = new Date("2026-10-19T04:00:00Z");
    const correct = summarizeRangeByJob(twoWeeks, RATES, TZ, MONDAY, start, end).job;
    expect(correct).toMatchObject({ paidMinutes: 4800, regularMinutes: 4800, overtimeMinutes: 0, earningsCents: 160000, shiftCount: 10 });

    // The old whole-range calculation, for contrast: 40 of the 80 hours as overtime.
    expect(summarizeShiftsByJob(twoWeeks, RATES).job.overtimeMinutes).toBe(2400);
  });

  it("splits overtime chronologically within each workweek", () => {
    // 5 x 10h in one week: 40h regular, the last 10h overtime.
    const week = weekdays(["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09"], 10);
    const totals = summarizeRangeByJob(week, RATES, TZ, MONDAY, new Date("2026-10-05T04:00:00Z"), new Date("2026-10-12T04:00:00Z")).job;
    expect(totals).toMatchObject({ regularMinutes: 2400, overtimeMinutes: 600, earningsCents: 80000 + 30000 });
  });

  it("counts earlier hours in the workweek toward the threshold when a range starts mid-week", () => {
    // Range starts Thursday; Mon-Wed already have 30h, so Thu+Fri (20h) are 10h regular + 10h overtime.
    const week = weekdays(["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09"], 10);
    const totals = summarizeRangeByJob(week, RATES, TZ, MONDAY, new Date("2026-10-08T04:00:00Z"), new Date("2026-10-12T04:00:00Z")).job;
    expect(totals).toMatchObject({ paidMinutes: 1200, regularMinutes: 600, overtimeMinutes: 600, shiftCount: 2 });
  });

  it("applies each job's own threshold separately", () => {
    const rates: Record<string, JobRateConfig> = { ...RATES, gig: { hourlyRateCents: 1500, overtimeRateCents: null, overtimeThresholdMinutes: null } };
    const mixed = [...weekdays(["2026-10-05", "2026-10-06"], 10), shift("2026-10-07", 30, "gig")];
    const totals = summarizeRangeByJob(mixed, rates, TZ, MONDAY, new Date("2026-10-05T04:00:00Z"), new Date("2026-10-12T04:00:00Z"));
    expect(totals.job.overtimeMinutes).toBe(0);
    expect(totals.gig).toMatchObject({ paidMinutes: 1800, overtimeMinutes: 0, earningsCents: 45000 });
  });

  it("skips shifts without a clock-out and shifts outside the range", () => {
    const open: ShiftSummaryInput = { jobId: "job", start: new Date("2026-10-06T13:00:00Z"), end: null, breaks: [] };
    const totals = summarizeRangeByJob([shift("2026-10-05"), open, shift("2026-10-20")], RATES, TZ, MONDAY, new Date("2026-10-05T04:00:00Z"), new Date("2026-10-12T04:00:00Z"));
    expect(totals.job).toMatchObject({ paidMinutes: 480, shiftCount: 1 });
  });

  it("returns nothing for an empty range", () => {
    expect(summarizeRangeByJob([], RATES, TZ, MONDAY, new Date(), new Date())).toEqual({});
  });
});

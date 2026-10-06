import { describe, expect, it } from "vitest";

import { splitShiftMinutes, summarizeRangeByJob } from "@/lib/calculations/range-summary";
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

describe("splitShiftMinutes (daily overtime and double time)", () => {
  const weeklyOnly = { weeklyMinutes: 2400, dailyMinutes: null, doubleTimeMinutes: null };
  const california = { weeklyMinutes: 2400, dailyMinutes: 480, doubleTimeMinutes: 720 };

  it("reduces to the plain weekly split without daily rules", () => {
    expect(splitShiftMinutes(600, 0, 2100, weeklyOnly)).toEqual({ regular: 300, overtime: 300, doubleTime: 0 });
    expect(splitShiftMinutes(600, 0, 0, { weeklyMinutes: null, dailyMinutes: null, doubleTimeMinutes: null })).toEqual({
      regular: 600,
      overtime: 0,
      doubleTime: 0,
    });
  });

  it("pays a 10-hour California day as 8 regular + 2 overtime", () => {
    expect(splitShiftMinutes(600, 0, 0, california)).toEqual({ regular: 480, overtime: 120, doubleTime: 0 });
  });

  it("pays a 13-hour day as 8 regular + 4 overtime + 1 double time", () => {
    expect(splitShiftMinutes(780, 0, 0, california)).toEqual({ regular: 480, overtime: 240, doubleTime: 60 });
  });

  it("counts earlier shifts the same day toward the daily threshold", () => {
    // 6h already worked today; a 4h second shift is 2h regular + 2h overtime.
    expect(splitShiftMinutes(240, 360, 360, california)).toEqual({ regular: 120, overtime: 120, doubleTime: 0 });
  });

  it("applies weekly overtime only to hours that weren't already daily overtime", () => {
    // 40 regular hours already this week (from 10h days paid 8 + 2): an 8h day is all overtime.
    expect(splitShiftMinutes(480, 0, 2400, california)).toEqual({ regular: 0, overtime: 480, doubleTime: 0 });
    // 36 regular so far: a 10h day is 4 regular, 4 weekly OT and 2 daily OT.
    expect(splitShiftMinutes(600, 0, 2160, california)).toEqual({ regular: 240, overtime: 360, doubleTime: 0 });
  });

  it("supports double time without daily overtime", () => {
    expect(
      splitShiftMinutes(780, 0, 0, { weeklyMinutes: null, dailyMinutes: null, doubleTimeMinutes: 720 })
    ).toEqual({ regular: 720, overtime: 0, doubleTime: 60 });
  });
});

describe("summarizeRangeByJob with daily overtime", () => {
  // $20/h, $30/h overtime, double time defaults to 2x ($40/h).
  const CA: Record<string, JobRateConfig> = {
    job: {
      hourlyRateCents: 2000,
      overtimeRateCents: 3000,
      overtimeThresholdMinutes: 2400,
      dailyOvertimeThresholdMinutes: 480,
      doubleTimeThresholdMinutes: 720,
      doubleTimeRateCents: null,
    },
  };
  const week = (start: string, end: string) => [new Date(start), new Date(end)] as const;

  it("pays five 10-hour days as 40 regular + 10 overtime", () => {
    const shifts = weekdays(["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09"], 10);
    const [from, to] = week("2026-10-05T04:00:00Z", "2026-10-12T04:00:00Z");
    expect(summarizeRangeByJob(shifts, CA, TZ, MONDAY, from, to).job).toMatchObject({
      regularMinutes: 2400,
      overtimeMinutes: 600,
      doubleTimeMinutes: 0,
      earningsCents: 80000 + 30000,
    });
  });

  it("pays double time at twice the hourly rate when no rate is set", () => {
    const [from, to] = week("2026-10-05T04:00:00Z", "2026-10-12T04:00:00Z");
    const totals = summarizeRangeByJob([shift("2026-10-05", 13)], CA, TZ, MONDAY, from, to).job;
    expect(totals).toMatchObject({ regularMinutes: 480, overtimeMinutes: 300, doubleTimeMinutes: 60 });
    // 8h x $20 + 4h x $30 + 1h x $40
    expect(totals.earningsCents).toBe(16000 + 12000 + 4000);
  });

  it("counts a shift crossing midnight toward the workday it starts", () => {
    // Mon 20:00 - Tue 04:00 Toronto, then a normal Tue 09:00 - 17:00 shift.
    const overnight: ShiftSummaryInput = {
      jobId: "job",
      start: new Date("2026-10-06T00:00:00Z"),
      end: new Date("2026-10-06T08:00:00Z"),
      breaks: [],
    };
    const [from, to] = week("2026-10-05T04:00:00Z", "2026-10-12T04:00:00Z");
    expect(summarizeRangeByJob([overnight, shift("2026-10-06")], CA, TZ, MONDAY, from, to).job).toMatchObject({
      regularMinutes: 960,
      overtimeMinutes: 0,
    });
  });

  it("leaves weekly-only jobs unchanged", () => {
    const shifts = weekdays(["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09"], 10);
    const [from, to] = week("2026-10-05T04:00:00Z", "2026-10-12T04:00:00Z");
    expect(summarizeRangeByJob(shifts, RATES, TZ, MONDAY, from, to).job).toMatchObject({
      regularMinutes: 2400,
      overtimeMinutes: 600,
      doubleTimeMinutes: 0,
    });
  });
});

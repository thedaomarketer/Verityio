import { describe, expect, it } from "vitest";

import { presetRange, resolveReportRange } from "@/lib/calculations/report-range";

const today = "2026-10-04";
const weekStart = "2026-09-28";

describe("presetRange", () => {
  it("covers the workweek, which can start in the previous month", () => {
    expect(presetRange("week", today, weekStart)).toEqual({ start: "2026-09-28", end: "2026-10-04" });
  });

  it("covers whole calendar months", () => {
    expect(presetRange("month", today, weekStart)).toEqual({ start: "2026-10-01", end: "2026-10-31" });
    expect(presetRange("lastMonth", today, weekStart)).toEqual({ start: "2026-09-01", end: "2026-09-30" });
    expect(presetRange("last3Months", today, weekStart)).toEqual({ start: "2026-08-01", end: "2026-10-31" });
    expect(presetRange("year", today, weekStart)).toEqual({ start: "2026-01-01", end: "2026-12-31" });
  });

  it("handles January (last month is in the previous year) and leap years", () => {
    expect(presetRange("lastMonth", "2028-01-15", "2028-01-10")).toEqual({ start: "2027-12-01", end: "2027-12-31" });
    expect(presetRange("lastMonth", "2028-03-02", "2028-02-28")).toEqual({ start: "2028-02-01", end: "2028-02-29" });
  });
});

describe("resolveReportRange", () => {
  const free = { today, weekStart, premium: false };
  const premium = { today, weekStart, premium: true };

  it("defaults to this month", () => {
    expect(resolveReportRange({}, free)).toMatchObject({ start: "2026-10-01", preset: "month", locked: false });
  });

  it("lets free plans use the short presets", () => {
    expect(resolveReportRange({ range: "lastMonth" }, free)).toMatchObject({ preset: "lastMonth", locked: false });
  });

  it("falls back to this month, flagged as locked, for Premium ranges on a free plan", () => {
    expect(resolveReportRange({ range: "year" }, free)).toMatchObject({ preset: "month", locked: true });
    expect(resolveReportRange({ start: "2026-01-01", end: "2026-03-31" }, free)).toMatchObject({ preset: "month", locked: true });
  });

  it("gives Premium custom ranges, swapping reversed dates", () => {
    expect(resolveReportRange({ start: "2026-03-31", end: "2026-01-01" }, premium)).toEqual({
      start: "2026-01-01",
      end: "2026-03-31",
      preset: "custom",
      locked: false,
    });
  });

  it("caps very long custom ranges", () => {
    expect(resolveReportRange({ start: "2010-01-01", end: "2026-01-01" }, premium).end).toBe("2012-01-02");
  });

  it("ignores malformed dates and unknown presets", () => {
    expect(resolveReportRange({ start: "yesterday", end: "2026-01-01", range: "forever" }, premium)).toMatchObject({
      preset: "month",
      locked: false,
    });
  });
});

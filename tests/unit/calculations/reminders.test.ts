import { describe, expect, it } from "vitest";

import { dueReminders, type ReminderInput } from "@/lib/calculations/reminders";

const TZ = "America/Toronto";

function input(overrides: Partial<ReminderInput>): ReminderInput {
  return {
    now: new Date("2024-06-14T14:00:00Z"), // Fri Jun 14, 10:00 in Toronto
    timezone: TZ,
    activeShift: null,
    openBreak: null,
    paydays: [],
    holidayNames: new Map(),
    ...overrides,
  };
}

describe("dueReminders", () => {
  it("nothing is due for an idle user", () => {
    expect(dueReminders(input({}))).toEqual([]);
  });

  it("flags a shift open for 12 hours or more, once per shift", () => {
    const shift = { id: "s1", startedAt: "2024-06-14T02:00:00Z", jobName: "Maple" }; // 12h ago
    expect(dueReminders(input({ activeShift: shift }))).toEqual([
      { kind: "long_shift", dedupeKey: "long_shift:s1", jobName: "Maple", minutes: 720 },
    ]);
    const younger = { ...shift, startedAt: "2024-06-14T02:01:00Z" }; // 11h59m
    expect(dueReminders(input({ activeShift: younger }))).toEqual([]);
  });

  it("flags a break open for an hour or more", () => {
    const openBreak = { id: "b1", startedAt: "2024-06-14T12:59:00Z" };
    expect(dueReminders(input({ openBreak }))).toEqual([{ kind: "long_break", dedupeKey: "long_break:b1", minutes: 61 }]);
    expect(dueReminders(input({ openBreak: { id: "b2", startedAt: "2024-06-14T13:30:00Z" } }))).toEqual([]);
  });

  it("sends a payday reminder on the local payday date, after 8am local", () => {
    const paydays = [{ jobId: "j1", jobName: "Maple", nextPayday: new Date("2024-06-14T04:00:00Z") }];
    expect(dueReminders(input({ paydays }))).toEqual([
      { kind: "payday", dedupeKey: "payday:j1:2024-06-14", jobName: "Maple", holidayName: null },
    ]);
    // 7:30 in Toronto: too early.
    expect(dueReminders(input({ paydays, now: new Date("2024-06-14T11:30:00Z") }))).toEqual([]);
    // The day before: not yet.
    expect(dueReminders(input({ paydays, now: new Date("2024-06-13T20:00:00Z") }))).toEqual([]);
  });

  it("uses the user's local date, not UTC, near midnight", () => {
    // 23:30 Jun 14 in Toronto is already Jun 15 in UTC.
    const now = new Date("2024-06-15T03:30:00Z");
    const paydays = [{ jobId: "j1", jobName: "Maple", nextPayday: new Date("2024-06-14T04:00:00Z") }];
    expect(dueReminders(input({ now, paydays })).map((r) => r.dedupeKey)).toEqual(["payday:j1:2024-06-14"]);
  });

  it("mentions a public holiday that falls on payday", () => {
    const now = new Date("2024-07-01T14:00:00Z");
    const paydays = [{ jobId: "j1", jobName: "Maple", nextPayday: new Date("2024-07-01T04:00:00Z") }];
    const holidayNames = new Map([["2024-07-01", "Canada Day"]]);
    expect(dueReminders(input({ now, paydays, holidayNames }))[0]).toMatchObject({ holidayName: "Canada Day" });
  });
});

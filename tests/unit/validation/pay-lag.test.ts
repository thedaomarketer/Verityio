import { describe, expect, it } from "vitest";

import { jobSchema, payLagFromJob } from "@/lib/validation/jobs";

const base = { name: "Olympic", color: "#2563eb", payFrequency: "biweekly" as const, payAnchorDate: "2026-09-24" };

describe("pay period end on the job form", () => {
  it("turns a known pay date and its period's last day into a lag", () => {
    expect(payLagFromJob({ payAnchorDate: "2026-09-24", payPeriodEndDate: "2026-09-20" })).toBe(4);
    expect(payLagFromJob({ payAnchorDate: "2026-09-24", payPeriodEndDate: "2026-09-24" })).toBe(0);
  });

  it("leaves the lag unset when the field is blank", () => {
    expect(payLagFromJob({ payAnchorDate: "2026-09-24", payPeriodEndDate: "" })).toBeNull();
    expect(jobSchema.safeParse({ ...base, payPeriodEndDate: "" }).success).toBe(true);
  });

  it("rejects a period ending after payday, more than a month before it, or without a pay date", () => {
    expect(jobSchema.safeParse({ ...base, payPeriodEndDate: "2026-09-25" }).success).toBe(false);
    expect(jobSchema.safeParse({ ...base, payPeriodEndDate: "2026-08-01" }).success).toBe(false);
    expect(jobSchema.safeParse({ ...base, payAnchorDate: "", payPeriodEndDate: "2026-09-20" }).success).toBe(false);
    expect(jobSchema.safeParse({ ...base, payPeriodEndDate: "2026-09-20" }).success).toBe(true);
  });
});

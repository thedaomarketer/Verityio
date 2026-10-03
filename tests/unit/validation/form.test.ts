import { describe, expect, it } from "vitest";

import { formText } from "@/lib/validation/form";
import { taxSettingsSchema } from "@/lib/validation/settings";
import { expenseSchema } from "@/lib/validation/expenses";

describe("formText", () => {
  it("returns the submitted string, or undefined for a control that wasn't submitted", () => {
    const form = new FormData();
    form.set("taxRegion", "ON");
    expect(formText(form, "taxRegion")).toBe("ON");
    expect(formText(form, "taxCity")).toBeUndefined();
  });
});

describe("tax jurisdiction form", () => {
  // Regression: choosing a Canadian province disables the City select, so
  // the browser omits it, and saving failed with "Please check the
  // highlighted details" because null isn't an optional string.
  it("saves a province with no city field submitted", () => {
    const form = new FormData();
    form.set("taxCountry", "CA");
    form.set("taxRegion", "ON");
    const parsed = taxSettingsSchema.safeParse({
      taxCountry: formText(form, "taxCountry"),
      taxRegion: formText(form, "taxRegion"),
      taxCity: formText(form, "taxCity"),
    });
    expect(parsed.success).toBe(true);
  });

  it("still requires a region once a country is chosen", () => {
    const parsed = taxSettingsSchema.safeParse({ taxCountry: "US", taxRegion: undefined, taxCity: undefined });
    expect(parsed.success).toBe(false);
  });
});

describe("expense form", () => {
  it("saves for someone with no jobs (the Job select isn't rendered)", () => {
    const form = new FormData();
    form.set("amount", "12.50");
    form.set("category", "meals");
    form.set("description", "");
    form.set("expenseDate", "2026-10-01");
    const parsed = expenseSchema.safeParse({
      jobId: formText(form, "jobId"),
      amount: form.get("amount"),
      category: form.get("category"),
      description: formText(form, "description"),
      expenseDate: form.get("expenseDate"),
    });
    expect(parsed.success).toBe(true);
  });
});

import { describe, expect, it } from "vitest";

import {
  bankTransactionsToSpending,
  budgetInsights,
  categorizeBankTransaction,
  dailySpending,
  emptyCategoryTotals,
  fiftyThirtyTwenty,
  hourlyRateCents,
  minutesOfWork,
  projectToMonthEnd,
  spendingByCategory,
  totalSpending,
  type CategoryTotals,
} from "@/lib/calculations/budget";

function totals(partial: Partial<CategoryTotals>): CategoryTotals {
  return { ...emptyCategoryTotals(), ...partial };
}

describe("categorizeBankTransaction", () => {
  it("leaves out income, transfers and credit-card payments", () => {
    expect(categorizeBankTransaction("INCOME", "INCOME_WAGES")).toBeNull();
    expect(categorizeBankTransaction("TRANSFER_OUT", "TRANSFER_OUT_SAVINGS")).toBeNull();
    expect(categorizeBankTransaction("TRANSFER_IN", null)).toBeNull();
    expect(categorizeBankTransaction("LOAN_PAYMENTS", "LOAN_PAYMENTS_CREDIT_CARD_PAYMENT")).toBeNull();
  });

  it("splits groceries from eating out", () => {
    expect(categorizeBankTransaction("FOOD_AND_DRINK", "FOOD_AND_DRINK_GROCERIES")).toBe("groceries");
    expect(categorizeBankTransaction("FOOD_AND_DRINK", "FOOD_AND_DRINK_COFFEE")).toBe("dining");
  });

  it("maps the rest and falls back to other", () => {
    expect(categorizeBankTransaction("RENT_AND_UTILITIES", "RENT_AND_UTILITIES_RENT")).toBe("housing");
    expect(categorizeBankTransaction("TRAVEL", null)).toBe("transport");
    expect(categorizeBankTransaction("LOAN_PAYMENTS", "LOAN_PAYMENTS_CAR_PAYMENT")).toBe("bills");
    expect(categorizeBankTransaction(null, null)).toBe("other");
    expect(categorizeBankTransaction("SOMETHING_NEW", null)).toBe("other");
  });
});

describe("spending totals", () => {
  const items = bankTransactionsToSpending([
    { date: "2026-10-01", amountCents: 5000, categoryPrimary: "FOOD_AND_DRINK", categoryDetailed: "FOOD_AND_DRINK_GROCERIES" },
    { date: "2026-10-01", amountCents: 1250, categoryPrimary: "FOOD_AND_DRINK", categoryDetailed: "FOOD_AND_DRINK_RESTAURANT" },
    { date: "2026-10-02", amountCents: -250000, categoryPrimary: "INCOME", categoryDetailed: "INCOME_WAGES" },
    { date: "2026-10-03", amountCents: 3000, categoryPrimary: "GENERAL_MERCHANDISE", categoryDetailed: null },
    { date: "2026-10-04", amountCents: -1000, categoryPrimary: "GENERAL_MERCHANDISE", categoryDetailed: null },
    { date: "2026-10-04", amountCents: -9000, categoryPrimary: "ENTERTAINMENT", categoryDetailed: null },
  ]);

  it("drops income and nets refunds without going negative", () => {
    const byCategory = spendingByCategory(items);
    expect(byCategory.groceries).toBe(5000);
    expect(byCategory.dining).toBe(1250);
    expect(byCategory.shopping).toBe(2000);
    expect(byCategory.entertainment).toBe(0);
    expect(totalSpending(byCategory)).toBe(8250);
  });

  it("buckets spending by day, including empty days", () => {
    expect(dailySpending(items, ["2026-09-30", "2026-10-01", "2026-10-03", "2026-10-04"])).toEqual([0, 6250, 3000, 0]);
  });
});

describe("work-time conversions", () => {
  it("expresses an amount as minutes of work at the user's own rate", () => {
    // $25/hour: earned $1,000 over 40 hours.
    expect(minutesOfWork(5000, 100000, 2400)).toBe(120);
    expect(hourlyRateCents(100000, 2400)).toBe(2500);
  });

  it("returns null rather than guessing without earnings", () => {
    expect(minutesOfWork(5000, 0, 0)).toBeNull();
    expect(minutesOfWork(0, 100000, 2400)).toBeNull();
    expect(hourlyRateCents(0, 60)).toBeNull();
  });
});

describe("projectToMonthEnd", () => {
  it("projects linearly and caps the day at the month length", () => {
    expect(projectToMonthEnd(10000, 10, 30)).toBe(30000);
    expect(projectToMonthEnd(10000, 31, 30)).toBe(10000);
    expect(projectToMonthEnd(10000, 0, 30)).toBe(0);
  });
});

describe("fiftyThirtyTwenty", () => {
  it("splits income into targets that add up exactly", () => {
    const plan = fiftyThirtyTwenty(100001, emptyCategoryTotals());
    expect(plan.needs.targetCents + plan.wants.targetCents + plan.savings.targetCents).toBe(100001);
    expect(plan.needs.targetCents).toBe(50001);
  });

  it("puts essentials in needs and the rest in wants", () => {
    const plan = fiftyThirtyTwenty(200000, totals({ housing: 90000, groceries: 20000, dining: 15000, shopping: 10000 }));
    expect(plan.needs.actualCents).toBe(110000);
    expect(plan.wants.actualCents).toBe(25000);
    expect(plan.savings.actualCents).toBe(65000);
  });

  it("shows negative savings when spending passes income", () => {
    expect(fiftyThirtyTwenty(1000, totals({ housing: 5000 })).savings.actualCents).toBe(-4000);
  });
});

describe("budgetInsights", () => {
  const base = { earnedCents: 200000, paidMinutes: 4800, dayOfMonth: 15, daysInMonth: 30 };

  it("returns nothing when there's no data", () => {
    expect(
      budgetInsights({ ...base, earnedCents: 0, paidMinutes: 0, thisMonth: emptyCategoryTotals(), lastMonthToDate: emptyCategoryTotals() })
    ).toEqual([]);
  });

  it("reports what was kept, the work-hours cost and the top category", () => {
    const insights = budgetInsights({
      ...base,
      thisMonth: totals({ housing: 80000, dining: 20000 }),
      lastMonthToDate: emptyCategoryTotals(),
    });
    expect(insights.find((i) => i.kind === "kept")).toMatchObject({ keptCents: 100000, percent: 50, tone: "positive" });
    // $25/h -> $1,000 is 40 hours.
    expect(insights.find((i) => i.kind === "workHours")).toMatchObject({ minutes: 2400 });
    expect(insights.find((i) => i.kind === "topCategory")).toMatchObject({ category: "housing", minutes: 1920 });
  });

  it("flags overspending first", () => {
    const insights = budgetInsights({ ...base, thisMonth: totals({ housing: 250000 }), lastMonthToDate: emptyCategoryTotals() });
    expect(insights[0]).toMatchObject({ kind: "overspent", overCents: 50000, tone: "warning" });
    expect(insights.find((i) => i.kind === "pace")).toMatchObject({ tone: "warning", projectedSpendCents: 500000 });
  });

  it("compares like-for-like with last month and ignores small changes", () => {
    const insights = budgetInsights({
      ...base,
      thisMonth: totals({ dining: 30000, shopping: 5000, groceries: 10500 }),
      lastMonthToDate: totals({ dining: 20000, shopping: 15000, groceries: 10000 }),
    });
    expect(insights.find((i) => i.kind === "categoryUp")).toMatchObject({ category: "dining", percent: 50, deltaCents: 10000 });
    expect(insights.find((i) => i.kind === "categoryDown")).toMatchObject({ category: "shopping", percent: 67, deltaCents: 10000 });
    expect(insights.some((i) => i.kind === "categoryUp" && i.category === "groceries")).toBe(false);
  });

  it("skips pace projections in the first days of the month", () => {
    const insights = budgetInsights({ ...base, dayOfMonth: 3, thisMonth: totals({ dining: 1000 }), lastMonthToDate: emptyCategoryTotals() });
    expect(insights.some((i) => i.kind === "pace")).toBe(false);
  });

  it("never returns more than five insights", () => {
    const insights = budgetInsights({
      ...base,
      thisMonth: totals({ housing: 250000, dining: 30000, shopping: 5000 }),
      lastMonthToDate: totals({ dining: 20000, shopping: 15000 }),
    });
    expect(insights.length).toBeLessThanOrEqual(5);
  });
});

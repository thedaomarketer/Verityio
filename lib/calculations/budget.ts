import type { ExpenseCategory } from "@/lib/supabase/database.types";

/**
 * Spending and budget insights, as pure integer-cents functions. Inputs are
 * bank transactions (Plaid's sign convention: positive = money out) or the
 * user's recorded expenses; outputs are categories, totals and insight
 * objects the UI turns into sentences. Nothing here is a payroll or tax
 * result -- the UI labels every projection as an estimate.
 */

/** Fixed order: it's also the chart color order (categorical colors are never cycled). */
export const SPENDING_CATEGORIES = [
  "housing",
  "groceries",
  "dining",
  "transport",
  "shopping",
  "bills",
  "health",
  "entertainment",
  "other",
] as const;
export type SpendingCategory = (typeof SPENDING_CATEGORIES)[number];

export type BudgetBucket = "needs" | "wants";

/** The 50/30/20 split: essentials vs. discretionary. */
export const CATEGORY_BUCKET: Record<SpendingCategory, BudgetBucket> = {
  housing: "needs",
  groceries: "needs",
  transport: "needs",
  bills: "needs",
  health: "needs",
  dining: "wants",
  shopping: "wants",
  entertainment: "wants",
  other: "wants",
};

export type CategoryTotals = Record<SpendingCategory, number>;

export function emptyCategoryTotals(): CategoryTotals {
  return Object.fromEntries(SPENDING_CATEGORIES.map((c) => [c, 0])) as CategoryTotals;
}

/**
 * Maps Plaid's personal finance category to ours. Returns null for money
 * that isn't spending: income, transfers between your own accounts, and
 * credit-card payments (the purchases were already counted on the card).
 */
export function categorizeBankTransaction(primary: string | null, detailed: string | null): SpendingCategory | null {
  if (detailed === "LOAN_PAYMENTS_CREDIT_CARD_PAYMENT") return null;
  switch (primary) {
    case "INCOME":
    case "TRANSFER_IN":
    case "TRANSFER_OUT":
      return null;
    case "FOOD_AND_DRINK":
      return detailed === "FOOD_AND_DRINK_GROCERIES" ? "groceries" : "dining";
    case "RENT_AND_UTILITIES":
    case "HOME_IMPROVEMENT":
      return "housing";
    case "TRANSPORTATION":
    case "TRAVEL":
      return "transport";
    case "GENERAL_MERCHANDISE":
    case "PERSONAL_CARE":
      return "shopping";
    case "MEDICAL":
      return "health";
    case "ENTERTAINMENT":
      return "entertainment";
    case "GENERAL_SERVICES":
    case "BANK_FEES":
    case "GOVERNMENT_AND_NON_PROFIT":
    case "LOAN_PAYMENTS":
      return "bills";
    default:
      return "other";
  }
}

/** Recorded work expenses, mapped onto the same categories. */
export const EXPENSE_TO_SPENDING: Record<ExpenseCategory, SpendingCategory> = {
  meals: "dining",
  transport: "transport",
  supplies: "shopping",
  equipment: "shopping",
  lodging: "housing",
  other: "other",
};

export interface SpendingItem {
  /** Local calendar date, YYYY-MM-DD. */
  date: string;
  /** Positive = money out; negative = refund/credit within a spending category. */
  amountCents: number;
  category: SpendingCategory;
}

export interface BankTransactionInput {
  date: string;
  amountCents: number;
  categoryPrimary: string | null;
  categoryDetailed: string | null;
}

export function bankTransactionsToSpending(transactions: BankTransactionInput[]): SpendingItem[] {
  return transactions.flatMap((t) => {
    const category = categorizeBankTransaction(t.categoryPrimary, t.categoryDetailed);
    return category ? [{ date: t.date, amountCents: t.amountCents, category }] : [];
  });
}

/** Net spend per category; refunds offset purchases but a category never goes below zero. */
export function spendingByCategory(items: SpendingItem[]): CategoryTotals {
  const totals = emptyCategoryTotals();
  for (const item of items) totals[item.category] += item.amountCents;
  for (const category of SPENDING_CATEGORIES) totals[category] = Math.max(0, totals[category]);
  return totals;
}

export function totalSpending(totals: CategoryTotals): number {
  return SPENDING_CATEGORIES.reduce((sum, c) => sum + totals[c], 0);
}

/** Net spend per day for `dates` (consecutive YYYY-MM-DD strings), floored at zero. */
export function dailySpending(items: SpendingItem[], dates: string[]): number[] {
  const byDate = new Map<string, number>();
  for (const item of items) byDate.set(item.date, (byDate.get(item.date) ?? 0) + item.amountCents);
  return dates.map((date) => Math.max(0, byDate.get(date) ?? 0));
}

/**
 * How many minutes of work an amount represents at the user's own average
 * paid rate this period (earned / paid minutes). Null when there's no rate
 * to go on yet.
 */
export function minutesOfWork(amountCents: number, earnedCents: number, paidMinutes: number): number | null {
  if (earnedCents <= 0 || paidMinutes <= 0 || amountCents <= 0) return null;
  return Math.round((amountCents * paidMinutes) / earnedCents);
}

/** Average earnings per paid hour, in cents. */
export function hourlyRateCents(earnedCents: number, paidMinutes: number): number | null {
  if (earnedCents <= 0 || paidMinutes <= 0) return null;
  return Math.round((earnedCents * 60) / paidMinutes);
}

/** Straight-line projection of a month-to-date total to the whole month. */
export function projectToMonthEnd(valueToDate: number, dayOfMonth: number, daysInMonth: number): number {
  if (dayOfMonth <= 0) return 0;
  return Math.round((valueToDate * daysInMonth) / Math.min(dayOfMonth, daysInMonth));
}

export interface BudgetLine {
  targetCents: number;
  actualCents: number;
}

export interface BudgetPlan {
  incomeCents: number;
  needs: BudgetLine;
  wants: BudgetLine;
  savings: BudgetLine;
}

/**
 * The 50/30/20 guideline applied to an income figure: half to needs, 30% to
 * wants, the rest saved. Targets always add up to the income exactly;
 * actual savings is whatever is left (negative when overspent).
 */
export function fiftyThirtyTwenty(incomeCents: number, spending: CategoryTotals): BudgetPlan {
  const income = Math.max(0, incomeCents);
  const needsTarget = Math.round((income * 50) / 100);
  const wantsTarget = Math.round((income * 30) / 100);
  let needs = 0;
  let wants = 0;
  for (const category of SPENDING_CATEGORIES) {
    if (CATEGORY_BUCKET[category] === "needs") needs += spending[category];
    else wants += spending[category];
  }
  return {
    incomeCents: income,
    needs: { targetCents: needsTarget, actualCents: needs },
    wants: { targetCents: wantsTarget, actualCents: wants },
    savings: { targetCents: income - needsTarget - wantsTarget, actualCents: income - needs - wants },
  };
}

export type InsightTone = "positive" | "neutral" | "warning";

export type BudgetInsight =
  | { kind: "workHours"; tone: InsightTone; spentCents: number; minutes: number }
  | { kind: "topCategory"; tone: InsightTone; category: SpendingCategory; spentCents: number; minutes: number | null }
  | { kind: "categoryUp"; tone: InsightTone; category: SpendingCategory; percent: number; deltaCents: number }
  | { kind: "categoryDown"; tone: InsightTone; category: SpendingCategory; percent: number; deltaCents: number }
  | { kind: "pace"; tone: InsightTone; projectedSpendCents: number; projectedEarnedCents: number }
  | { kind: "kept"; tone: InsightTone; keptCents: number; percent: number }
  | { kind: "overspent"; tone: InsightTone; overCents: number };

export interface InsightInput {
  earnedCents: number;
  paidMinutes: number;
  thisMonth: CategoryTotals;
  /** Last month up to the same day of the month, for a like-for-like comparison. */
  lastMonthToDate: CategoryTotals;
  dayOfMonth: number;
  daysInMonth: number;
}

/** Changes smaller than this (in cents or percent) aren't worth mentioning. */
const MIN_CHANGE_CENTS = 2000;
const MIN_CHANGE_PERCENT = 20;
/** Projections from the first few days of a month are noise. */
const MIN_DAYS_FOR_PACE = 5;

/**
 * Up to five insights, most useful first. Each is derived only from the
 * numbers passed in -- nothing is invented when data is missing; the insight
 * is simply left out.
 */
export function budgetInsights(input: InsightInput): BudgetInsight[] {
  const insights: BudgetInsight[] = [];
  const spent = totalSpending(input.thisMonth);

  if (spent > 0 && input.earnedCents > 0) {
    const kept = input.earnedCents - spent;
    insights.push(
      kept >= 0
        ? { kind: "kept", tone: "positive", keptCents: kept, percent: Math.floor((kept * 100) / input.earnedCents) }
        : { kind: "overspent", tone: "warning", overCents: -kept }
    );
  }

  const workMinutes = minutesOfWork(spent, input.earnedCents, input.paidMinutes);
  if (workMinutes !== null) insights.push({ kind: "workHours", tone: "neutral", spentCents: spent, minutes: workMinutes });

  const top = [...SPENDING_CATEGORIES].sort((a, b) => input.thisMonth[b] - input.thisMonth[a])[0];
  if (top && input.thisMonth[top] > 0) {
    insights.push({
      kind: "topCategory",
      tone: "neutral",
      category: top,
      spentCents: input.thisMonth[top],
      minutes: minutesOfWork(input.thisMonth[top], input.earnedCents, input.paidMinutes),
    });
  }

  let biggestUp: { category: SpendingCategory; delta: number; percent: number } | null = null;
  let biggestDown: { category: SpendingCategory; delta: number; percent: number } | null = null;
  for (const category of SPENDING_CATEGORIES) {
    const before = input.lastMonthToDate[category];
    const now = input.thisMonth[category];
    if (before < MIN_CHANGE_CENTS) continue;
    const delta = now - before;
    const percent = Math.round((delta * 100) / before);
    if (delta >= MIN_CHANGE_CENTS && percent >= MIN_CHANGE_PERCENT && (!biggestUp || delta > biggestUp.delta)) {
      biggestUp = { category, delta, percent };
    }
    if (-delta >= MIN_CHANGE_CENTS && -percent >= MIN_CHANGE_PERCENT && (!biggestDown || delta < biggestDown.delta)) {
      biggestDown = { category, delta, percent };
    }
  }
  if (biggestUp) {
    insights.push({ kind: "categoryUp", tone: "warning", category: biggestUp.category, percent: biggestUp.percent, deltaCents: biggestUp.delta });
  }
  if (biggestDown) {
    insights.push({
      kind: "categoryDown",
      tone: "positive",
      category: biggestDown.category,
      percent: -biggestDown.percent,
      deltaCents: -biggestDown.delta,
    });
  }

  if (input.dayOfMonth >= MIN_DAYS_FOR_PACE && spent > 0 && input.earnedCents > 0) {
    const projectedSpendCents = projectToMonthEnd(spent, input.dayOfMonth, input.daysInMonth);
    const projectedEarnedCents = projectToMonthEnd(input.earnedCents, input.dayOfMonth, input.daysInMonth);
    insights.push({
      kind: "pace",
      tone: projectedSpendCents > projectedEarnedCents ? "warning" : "neutral",
      projectedSpendCents,
      projectedEarnedCents,
    });
  }

  // Warnings first, then the rest in the order built above.
  const rank: Record<InsightTone, number> = { warning: 0, positive: 1, neutral: 1 };
  return insights
    .map((insight, i) => ({ insight, i }))
    .sort((a, b) => rank[a.insight.tone] - rank[b.insight.tone] || a.i - b.i)
    .slice(0, 5)
    .map(({ insight }) => insight);
}

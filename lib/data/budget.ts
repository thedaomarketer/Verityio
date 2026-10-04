import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  addDaysToDateString,
  addMonthsToMonthString,
  bankTransactionsToSpending,
  budgetInsights,
  dailySpending,
  dollarsToCents,
  EXPENSE_TO_SPENDING,
  fiftyThirtyTwenty,
  localDateString,
  localDayStart,
  localMonthString,
  projectToMonthEnd,
  spendingByCategory,
  summarizeRangeByJob,
  getWorkweekBounds,
  sumJobSummaries,
  totalSpending,
  type SpendingItem,
} from "@/lib/calculations";
import { cumulative } from "@/lib/charts/line";
import type { UserContext } from "./context";
import { jobRatesFrom, shiftInputsFrom } from "./earnings";

function daysInMonth(month: string): number {
  const [year, m] = month.split("-").map(Number);
  return new Date(Date.UTC(year, m, 0)).getUTCDate();
}

function datesFrom(start: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => addDaysToDateString(start, i));
}

/**
 * Everything the Budget page shows, for the current month in the user's
 * time zone: spending (from linked banks, or from recorded expenses when no
 * bank is linked), this month's earnings and hours, last month to the same
 * day for comparison, and the derived insights and 50/30/20 plan.
 */
export async function getBudgetData(ctx: UserContext) {
  const supabase = await createClient();
  const now = new Date();
  const thisMonth = localMonthString(now, ctx.timezone);
  const monthStart = `${thisMonth}-01`;
  const today = localDateString(now, ctx.timezone);
  const dayOfMonth = Number(today.slice(8, 10));
  const monthDays = daysInMonth(thisMonth);

  const lastMonth = addMonthsToMonthString(thisMonth, -1);
  const lastMonthStart = `${lastMonth}-01`;
  const lastMonthComparableDays = Math.min(dayOfMonth, daysInMonth(lastMonth));
  const lastMonthToDateEnd = addDaysToDateString(lastMonthStart, lastMonthComparableDays - 1);

  const [{ data: jobs }, { data: shifts }, items, accounts, transactions, { data: expenses }] = await Promise.all([
    supabase.from("jobs").select("id, hourly_rate, overtime_rate, overtime_threshold_minutes").eq("user_id", ctx.userId),
    supabase
      .from("shifts")
      .select("job_id, actual_start, actual_end, breaks(started_at, ended_at, is_paid)")
      .eq("user_id", ctx.userId)
      .eq("status", "completed")
      // From the start of the workweek the month begins in: those days count toward that week's overtime.
      .gte("actual_start", getWorkweekBounds(localDayStart(monthStart, ctx.timezone), ctx.timezone, ctx.weekStartsOn).start.toISOString())
      .lt("actual_start", now.toISOString()),
    // The bank tables arrive with migration 24; until then these read as empty.
    supabase
      .from("bank_items")
      .select("id, institution_name, status, last_synced_at")
      .eq("user_id", ctx.userId)
      .order("created_at")
      .then(({ data }) => data ?? []),
    supabase
      .from("bank_accounts")
      .select("id, item_id, name, mask, subtype, current_balance, available_balance, iso_currency_code")
      .eq("user_id", ctx.userId)
      .order("name")
      .then(({ data }) => data ?? []),
    supabase
      .from("bank_transactions")
      .select("id, date, name, merchant_name, amount, iso_currency_code, category_primary, category_detailed, pending")
      .eq("user_id", ctx.userId)
      .gte("date", lastMonthStart)
      .lte("date", today)
      .order("date", { ascending: false })
      .limit(5000)
      .then(({ data }) => data ?? []),
    supabase
      .from("expenses")
      .select("expense_date, amount, category")
      .eq("user_id", ctx.userId)
      .gte("expense_date", lastMonthStart)
      .lte("expense_date", today),
  ]);

  const source: "bank" | "expenses" = items.length > 0 ? "bank" : "expenses";
  const spendingItems: SpendingItem[] =
    source === "bank"
      ? bankTransactionsToSpending(
          transactions.map((t) => ({
            date: t.date,
            amountCents: dollarsToCents(t.amount),
            categoryPrimary: t.category_primary,
            categoryDetailed: t.category_detailed,
          }))
        )
      : (expenses ?? []).map((e) => ({
          date: e.expense_date,
          amountCents: dollarsToCents(e.amount),
          category: EXPENSE_TO_SPENDING[e.category],
        }));

  const thisMonthItems = spendingItems.filter((i) => i.date >= monthStart && i.date <= today);
  const lastMonthItems = spendingItems.filter((i) => i.date >= lastMonthStart && i.date <= lastMonthToDateEnd);
  const thisMonthByCategory = spendingByCategory(thisMonthItems);
  const lastMonthByCategory = spendingByCategory(lastMonthItems);
  const spentCents = totalSpending(thisMonthByCategory);

  const earnings = sumJobSummaries(
    summarizeRangeByJob(
      shiftInputsFrom(shifts ?? []),
      jobRatesFrom(jobs ?? []),
      ctx.timezone,
      ctx.weekStartsOn,
      localDayStart(monthStart, ctx.timezone),
      now
    )
  );

  // Spending to date, day by day, against last month at the same point.
  const thisMonthDates = datesFrom(monthStart, dayOfMonth);
  const lastMonthDates = datesFrom(lastMonthStart, lastMonthComparableDays);
  const cumulativeThis = cumulative(dailySpending(thisMonthItems, thisMonthDates));
  const cumulativeLast = cumulative(dailySpending(lastMonthItems, lastMonthDates));

  return {
    source,
    today,
    dayOfMonth,
    daysInMonth: monthDays,
    spentCents,
    lastMonthToDateCents: totalSpending(lastMonthByCategory),
    byCategory: thisMonthByCategory,
    earnedCents: earnings.earningsCents,
    paidMinutes: earnings.paidMinutes,
    projectedEarnedCents: projectToMonthEnd(earnings.earningsCents, dayOfMonth, monthDays),
    trend: thisMonthDates.map((date, i) => ({
      date,
      thisMonth: cumulativeThis[i],
      lastMonth: cumulativeLast[i] ?? cumulativeLast[cumulativeLast.length - 1] ?? 0,
    })),
    insights: budgetInsights({
      earnedCents: earnings.earningsCents,
      paidMinutes: earnings.paidMinutes,
      thisMonth: thisMonthByCategory,
      lastMonthToDate: lastMonthByCategory,
      dayOfMonth,
      daysInMonth: monthDays,
    }),
    // The plan is based on this month's projected earnings -- an estimate, and labeled as one.
    plan: fiftyThirtyTwenty(projectToMonthEnd(earnings.earningsCents, dayOfMonth, monthDays), thisMonthByCategory),
    banks: items.map((item) => ({ ...item, accounts: accounts.filter((a) => a.item_id === item.id) })),
    recentTransactions: transactions.filter((t) => t.date >= monthStart).slice(0, 8),
  };
}

export type BudgetData = Awaited<ReturnType<typeof getBudgetData>>;

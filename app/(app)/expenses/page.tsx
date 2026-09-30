import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/data/context";
import { dollarsToCents, formatCents, localMonthString } from "@/lib/calculations";
import { getI18n } from "@/lib/i18n/server";
import type { ExpenseCategory } from "@/lib/supabase/database.types";
import { CreateExpenseDialog } from "@/components/expenses/create-expense-dialog";
import { ExpensesList } from "@/components/expenses/expenses-list";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function ExpensesPage() {
  const [ctx, { intl, m }] = await Promise.all([requireUserContext(), getI18n()]);
  if (!ctx) redirect("/login");

  const supabase = await createClient();
  // expense_date is a calendar date, so "this month" is a yyyy-mm prefix
  // match against the user's current local month.
  const month = localMonthString(new Date(), ctx.timezone);

  const [{ data: expenses }, { data: jobs }] = await Promise.all([
    supabase
      .from("expenses")
      .select("*, job:jobs(name, color)")
      .eq("user_id", ctx.userId)
      .order("expense_date", { ascending: false })
      .limit(200),
    supabase.from("jobs").select("id, name").eq("user_id", ctx.userId).eq("is_active", true),
  ]);

  let monthTotalCents = 0;
  const byCategory = new Map<ExpenseCategory, number>();
  for (const e of expenses ?? []) {
    if (!e.expense_date.startsWith(month)) continue;
    const cents = dollarsToCents(e.amount);
    monthTotalCents += cents;
    byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + cents);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-[28px] leading-tight font-bold tracking-tight md:text-3xl">{m.expenses.title}</h1>
        <CreateExpenseDialog jobs={jobs ?? []} timezone={ctx.timezone} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{m.common.thisMonth}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-3xl font-semibold tabular-nums">
            {formatCents(monthTotalCents, ctx.currency, intl)}
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
            {[...byCategory.entries()].map(([category, cents]) => (
              <span key={category}>
                {m.expenses.categories[category]}{" "}
                <span className="font-medium text-foreground">{formatCents(cents, ctx.currency, intl)}</span>
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="px-0 pt-6 sm:px-6">
          <ExpensesList expenses={expenses ?? []} />
        </CardContent>
      </Card>
    </div>
  );
}

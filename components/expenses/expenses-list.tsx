"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { deleteExpenseAction } from "@/lib/actions/expenses";
import { dollarsToCents, formatCents } from "@/lib/calculations/money";
import { formatCalendarDate } from "@/lib/format";
import { useI18n } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import type { ExpenseCategory } from "@/lib/supabase/database.types";
import { ReceiptSheet } from "./receipt-sheet";

export interface ExpenseRow {
  id: string;
  amount: number;
  currency: string;
  category: ExpenseCategory;
  description: string | null;
  expense_date: string;
  receipt_url: string | null;
  job: { name: string; color: string } | null;
}

const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  meals: "var(--chart-1)",
  transport: "var(--chart-2)",
  supplies: "var(--chart-3)",
  equipment: "var(--chart-4)",
  lodging: "var(--chart-5)",
  other: "var(--chart-6)",
};

/** Expenses as a list (one row per expense, thumb-sized actions) rather than a dense table. */
export function ExpensesList({ expenses, userId }: { expenses: ExpenseRow[]; userId: string }) {
  const [isPending, startTransition] = useTransition();
  const { intl, m } = useI18n();

  if (expenses.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">{m.expenses.empty}</p>;
  }

  return (
    <ul className="divide-y divide-black/[0.06]">
      {expenses.map((expense) => {
        const title = expense.description || m.expenses.categories[expense.category];
        return (
          <li key={expense.id} className="flex items-center gap-3 py-2.5 pr-1 pl-5 sm:pl-0">
            <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[expense.category] }} aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px]">{title}</p>
              <p className="truncate text-xs text-muted-foreground">
                {formatCalendarDate(expense.expense_date, intl)} · {m.expenses.categories[expense.category]}
                {expense.job && ` · ${expense.job.name}`}
              </p>
            </div>
            <span className="shrink-0 font-medium tabular-nums">
              {formatCents(dollarsToCents(expense.amount), expense.currency, intl)}
            </span>
            <ReceiptSheet userId={userId} expenseId={expense.id} hasReceipt={Boolean(expense.receipt_url)} title={title} />
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground"
              aria-label={m.expenses.deleteExpense}
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  const result = await deleteExpenseAction(expense.id);
                  if (result.error) toast.error(result.error);
                })
              }
            >
              <Trash2 className="size-4" />
            </Button>
          </li>
        );
      })}
    </ul>
  );
}

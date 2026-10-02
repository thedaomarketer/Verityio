import Papa from "papaparse";
import { APP_SLUG } from "@/lib/brand";
import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { isDateString } from "@/lib/calculations";
import { getI18n } from "@/lib/i18n/server";

export async function GET(request: NextRequest) {
  const { m } = await getI18n();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: m.errors.mustSignIn }, { status: 401 });

  const { searchParams } = request.nextUrl;
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  let query = supabase
    .from("expenses")
    .select("*, job:jobs(name)")
    .eq("user_id", user.id)
    .order("expense_date", { ascending: true });

  // expense_date is a calendar date, so the range compares dates directly.
  if (start && isDateString(start)) query = query.gte("expense_date", start);
  if (end && isDateString(end)) query = query.lte("expense_date", end);

  const { data: expenses } = await query;
  const c = m.csv;

  const rows = (expenses ?? []).map((expense) => ({
    [c.date]: expense.expense_date,
    [c.job]: expense.job?.name ?? "",
    [c.category]: m.expenses.categories[expense.category],
    // Kept as a plain number (no symbol/grouping) so spreadsheets can sum it.
    [c.amount]: expense.amount,
    [c.currency]: expense.currency,
    [c.description]: expense.description ?? "",
  }));

  const csv = Papa.unparse(rows, {
    columns: [c.date, c.job, c.category, c.amount, c.currency, c.description],
  });

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${APP_SLUG}-expenses.csv"`,
    },
  });
}

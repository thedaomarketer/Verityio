"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getI18n } from "@/lib/i18n/server";
import { validationMessage } from "@/lib/i18n/validation";
import { formText } from "@/lib/validation/form";
import { logAudit } from "@/lib/audit/log";
import { expenseSchema } from "@/lib/validation/expenses";
import type { ExpenseCategory } from "@/lib/supabase/database.types";

export interface ActionResult {
  error?: string;
}

export async function createExpenseAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const { m } = await getI18n();
  const parsed = expenseSchema.safeParse({
    jobId: formText(formData, "jobId"),
    amount: formData.get("amount"),
    category: formData.get("category"),
    description: formText(formData, "description"),
    expenseDate: formData.get("expenseDate"),
  });

  if (!parsed.success) {
    return { error: validationMessage(m, parsed.error) };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: m.errors.mustSignIn };

  const { data: profile } = await supabase.from("profiles").select("currency").eq("id", user.id).maybeSingle();

  const { data, error } = await supabase
    .from("expenses")
    .insert({
      user_id: user.id,
      job_id: parsed.data.jobId || null,
      amount: parsed.data.amount,
      currency: profile?.currency ?? "USD",
      category: parsed.data.category as ExpenseCategory,
      description: parsed.data.description || null,
      expense_date: parsed.data.expenseDate,
    })
    .select("id")
    .single();

  if (error) {
    return { error: m.errors.expenseSaveFailed };
  }

  await logAudit({ userId: user.id, entityType: "expense", entityId: data.id, action: "created" });

  revalidatePath("/expenses");
  revalidatePath("/reports");
  return {};
}

export async function deleteExpenseAction(expenseId: string): Promise<ActionResult> {
  const { m } = await getI18n();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: m.errors.mustSignIn };

  const { data: before } = await supabase
    .from("expenses")
    .select("*")
    .eq("id", expenseId)
    .eq("user_id", user.id)
    .maybeSingle();

  const { error } = await supabase.from("expenses").delete().eq("id", expenseId).eq("user_id", user.id);
  if (error) return { error: m.errors.expenseDeleteFailed };

  await logAudit({ userId: user.id, entityType: "expense", entityId: expenseId, action: "deleted", oldData: before });

  revalidatePath("/expenses");
  revalidatePath("/reports");
  return {};
}

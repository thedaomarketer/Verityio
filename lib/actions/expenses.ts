"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getI18n } from "@/lib/i18n/server";
import { validationMessage } from "@/lib/i18n/validation";
import { formText } from "@/lib/validation/form";
import { logAudit } from "@/lib/audit/log";
import { expenseSchema } from "@/lib/validation/expenses";
import type { ExpenseCategory } from "@/lib/supabase/database.types";
import { ATTACHMENTS_BUCKET } from "@/lib/uploads/paths";

export interface ActionResult {
  error?: string;
  /** The new expense's id, so the form can attach a receipt to it. */
  id?: string;
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
  return { id: data.id };
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

  // Attachments are polymorphic (no foreign key to cascade), so remove the
  // expense's receipt files and rows explicitly.
  const { data: receipts } = await supabase
    .from("attachments")
    .select("id, storage_path")
    .eq("user_id", user.id)
    .eq("entity_type", "expense")
    .eq("entity_id", expenseId);
  if (receipts?.length) {
    await supabase.storage.from(ATTACHMENTS_BUCKET).remove(receipts.map((r) => r.storage_path));
    await supabase.from("attachments").delete().in("id", receipts.map((r) => r.id));
  }

  await logAudit({ userId: user.id, entityType: "expense", entityId: expenseId, action: "deleted", oldData: before });

  revalidatePath("/expenses");
  revalidatePath("/reports");
  return {};
}

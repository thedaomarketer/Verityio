"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getI18n } from "@/lib/i18n/server";
import { validationMessage } from "@/lib/i18n/validation";
import { formText } from "@/lib/validation/form";
import { logAudit } from "@/lib/audit/log";
import { mileageEntrySchema } from "@/lib/validation/mileage";

export interface ActionResult {
  error?: string;
}

export async function createMileageEntryAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const { m } = await getI18n();
  const parsed = mileageEntrySchema.safeParse({
    jobId: formText(formData, "jobId"),
    date: formData.get("date"),
    startLocation: formText(formData, "startLocation"),
    endLocation: formText(formData, "endLocation"),
    distance: formData.get("distance"),
    unit: formData.get("unit") || "km",
    rate: formData.get("rate") || 0,
    notes: formText(formData, "notes"),
  });

  if (!parsed.success) {
    return { error: validationMessage(m, parsed.error) };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: m.errors.mustSignIn };

  const reimbursement = Math.round(parsed.data.distance * parsed.data.rate * 100) / 100;

  const { data, error } = await supabase
    .from("mileage_entries")
    .insert({
      user_id: user.id,
      job_id: parsed.data.jobId || null,
      date: parsed.data.date,
      start_location: parsed.data.startLocation || null,
      end_location: parsed.data.endLocation || null,
      distance: parsed.data.distance,
      unit: parsed.data.unit,
      rate: parsed.data.rate,
      reimbursement,
      notes: parsed.data.notes || null,
    })
    .select("id")
    .single();

  if (error) {
    return { error: m.errors.tripSaveFailed };
  }

  await logAudit({ userId: user.id, entityType: "mileage_entry", entityId: data.id, action: "created" });

  revalidatePath("/mileage");
  revalidatePath("/reports");
  return {};
}

export async function deleteMileageEntryAction(entryId: string): Promise<ActionResult> {
  const { m } = await getI18n();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: m.errors.mustSignIn };

  const { data: before } = await supabase
    .from("mileage_entries")
    .select("*")
    .eq("id", entryId)
    .eq("user_id", user.id)
    .maybeSingle();

  const { error } = await supabase.from("mileage_entries").delete().eq("id", entryId).eq("user_id", user.id);
  if (error) return { error: m.errors.tripDeleteFailed };

  await logAudit({
    userId: user.id,
    entityType: "mileage_entry",
    entityId: entryId,
    action: "deleted",
    oldData: before,
  });

  revalidatePath("/mileage");
  revalidatePath("/reports");
  return {};
}

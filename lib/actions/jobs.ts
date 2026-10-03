"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getI18n } from "@/lib/i18n/server";
import { validationMessage } from "@/lib/i18n/validation";
import { formText } from "@/lib/validation/form";
import { logAudit } from "@/lib/audit/log";
import { jobSchema } from "@/lib/validation/jobs";

export interface ActionResult {
  error?: string;
}

function parseJobForm(formData: FormData) {
  return jobSchema.safeParse({
    name: formData.get("name"),
    companyName: formText(formData, "companyName"),
    jobTitle: formText(formData, "jobTitle"),
    description: formText(formData, "description"),
    hourlyRate: formData.get("hourlyRate") || undefined,
    overtimeRate: formData.get("overtimeRate") || undefined,
    overtimeThresholdHours: formData.get("overtimeThresholdHours") || undefined,
    startDate: formText(formData, "startDate"),
    endDate: formText(formData, "endDate"),
    color: formData.get("color") || "#2563eb",
    notes: formText(formData, "notes"),
    payFrequency: formData.get("payFrequency") || undefined,
    payAnchorDate: formText(formData, "payAnchorDate"),
  });
}

export async function createJobAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const { m } = await getI18n();
  const parsed = parseJobForm(formData);
  if (!parsed.success) {
    return { error: validationMessage(m, parsed.error) };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: m.errors.mustSignIn };

  const { data, error } = await supabase
    .from("jobs")
    .insert({
      user_id: user.id,
      name: parsed.data.name,
      company_name: parsed.data.companyName || null,
      job_title: parsed.data.jobTitle || null,
      description: parsed.data.description || null,
      hourly_rate: parsed.data.hourlyRate ?? null,
      overtime_rate: parsed.data.overtimeRate ?? null,
      overtime_threshold_minutes:
        parsed.data.overtimeThresholdHours != null ? Math.round(parsed.data.overtimeThresholdHours * 60) : null,
      start_date: parsed.data.startDate || null,
      end_date: parsed.data.endDate || null,
      color: parsed.data.color,
      notes: parsed.data.notes || null,
      pay_frequency: parsed.data.payFrequency || null,
      pay_anchor_date: parsed.data.payAnchorDate || null,
    })
    .select("id")
    .single();

  if (error) {
    return { error: m.errors.jobSaveFailed };
  }

  await logAudit({
    userId: user.id,
    entityType: "job",
    entityId: data.id,
    action: "created",
    newData: parsed.data,
  });

  revalidatePath("/jobs");
  revalidatePath("/dashboard");
  return {};
}

export async function updateJobAction(
  jobId: string,
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const { m } = await getI18n();
  const parsed = parseJobForm(formData);
  if (!parsed.success) {
    return { error: validationMessage(m, parsed.error) };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: m.errors.mustSignIn };

  const { data: before } = await supabase
    .from("jobs")
    .select("*")
    .eq("id", jobId)
    .eq("user_id", user.id)
    .maybeSingle();

  const { error } = await supabase
    .from("jobs")
    .update({
      name: parsed.data.name,
      company_name: parsed.data.companyName || null,
      job_title: parsed.data.jobTitle || null,
      description: parsed.data.description || null,
      hourly_rate: parsed.data.hourlyRate ?? null,
      overtime_rate: parsed.data.overtimeRate ?? null,
      overtime_threshold_minutes:
        parsed.data.overtimeThresholdHours != null ? Math.round(parsed.data.overtimeThresholdHours * 60) : null,
      start_date: parsed.data.startDate || null,
      end_date: parsed.data.endDate || null,
      color: parsed.data.color,
      notes: parsed.data.notes || null,
      pay_frequency: parsed.data.payFrequency || null,
      pay_anchor_date: parsed.data.payAnchorDate || null,
    })
    .eq("id", jobId)
    .eq("user_id", user.id);

  if (error) {
    return { error: m.errors.jobUpdateFailed };
  }

  await logAudit({
    userId: user.id,
    entityType: "job",
    entityId: jobId,
    action: "updated",
    oldData: before,
    newData: parsed.data,
  });

  revalidatePath("/jobs");
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/dashboard");
  return {};
}

export async function setJobActiveAction(jobId: string, isActive: boolean): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("jobs").update({ is_active: isActive }).eq("id", jobId).eq("user_id", user.id);

  await logAudit({
    userId: user.id,
    entityType: "job",
    entityId: jobId,
    action: "updated",
    newData: { is_active: isActive },
  });

  revalidatePath("/jobs");
  revalidatePath("/dashboard");
}

export async function deleteJobAction(jobId: string): Promise<ActionResult> {
  const { m } = await getI18n();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: m.errors.mustSignIn };

  const { error } = await supabase.from("jobs").delete().eq("id", jobId).eq("user_id", user.id);

  if (error) {
    return { error: m.errors.jobDeleteBlocked };
  }

  await logAudit({ userId: user.id, entityType: "job", entityId: jobId, action: "deleted" });

  revalidatePath("/jobs");
  revalidatePath("/dashboard");
  return {};
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getI18n, setLocaleCookie } from "@/lib/i18n/server";
import { validationMessage } from "@/lib/i18n/validation";
import { formText } from "@/lib/validation/form";
import { createAdminClient } from "@/lib/supabase/admin";
import { revokeBankItems } from "@/lib/bank/revoke";
import { ATTACHMENTS_BUCKET } from "@/lib/uploads/paths";
import { cancelSubscriptionForDeletedAccount } from "@/lib/billing/cancel";
import { logAudit } from "@/lib/audit/log";
import {
  preferencesSchema,
  profileSchema,
  regionSchema,
  taxSettingsSchema,
  timeZoneSchema,
} from "@/lib/validation/settings";

export interface ActionResult {
  error?: string;
  success?: boolean;
}

export async function updateProfileAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const { m } = await getI18n();
  const parsed = profileSchema.safeParse({
    fullName: formData.get("fullName"),
    phone: formText(formData, "phone"),
    country: formText(formData, "country"),
    defaultHourlyRate: formData.get("defaultHourlyRate") || undefined,
  });

  if (!parsed.success) {
    return { error: validationMessage(m, parsed.error) };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: m.errors.mustSignIn };

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.fullName,
      phone: parsed.data.phone || null,
      country: parsed.data.country || null,
      default_hourly_rate: parsed.data.defaultHourlyRate ?? null,
    })
    .eq("id", user.id);

  if (error) {
    return { error: m.errors.profileSaveFailed };
  }

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function updateRegionAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const { m } = await getI18n();
  const parsed = regionSchema.safeParse({
    locale: formData.get("locale"),
    timezone: formData.get("timezone"),
    currency: formData.get("currency"),
  });

  if (!parsed.success) {
    return { error: validationMessage(m, parsed.error) };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: m.errors.mustSignIn };

  const { error } = await supabase
    .from("profiles")
    .update({
      locale: parsed.data.locale,
      timezone: parsed.data.timezone,
      currency: parsed.data.currency,
    })
    .eq("id", user.id);

  if (error) {
    return { error: m.errors.regionSaveFailed };
  }

  await setLocaleCookie(parsed.data.locale);
  // Every page's dates, totals, and text depend on these.
  revalidatePath("/", "layout");
  return { success: true };
}

/** One-tap switch from the "your device is in a different time zone" prompt. */
export async function updateTimeZoneAction(timezone: string): Promise<ActionResult> {
  const { m } = await getI18n();
  const parsed = timeZoneSchema.safeParse(timezone);
  if (!parsed.success) return { error: validationMessage(m, parsed.error) };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: m.errors.mustSignIn };

  const { error } = await supabase.from("profiles").update({ timezone: parsed.data }).eq("id", user.id);
  if (error) return { error: m.errors.regionSaveFailed };

  revalidatePath("/", "layout");
  return { success: true };
}

export async function updatePreferencesAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const { m } = await getI18n();
  const parsed = preferencesSchema.safeParse({
    weekStartsOn: formData.get("weekStartsOn"),
    defaultBreakMinutes: formData.get("defaultBreakMinutes"),
    overtimeEnabled: formData.get("overtimeEnabled"),
    overtimeThresholdHours: formData.get("overtimeThresholdHours"),
    notificationsEnabled: formData.get("notificationsEnabled"),
  });

  if (!parsed.success) {
    return { error: validationMessage(m, parsed.error) };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: m.errors.mustSignIn };

  // Upsert, not update: an update on a missing row "succeeds" while saving nothing.
  const { error } = await supabase.from("user_settings").upsert(
    {
      user_id: user.id,
      week_starts_on: parsed.data.weekStartsOn,
      default_break_minutes: parsed.data.defaultBreakMinutes,
      overtime_enabled: parsed.data.overtimeEnabled,
      overtime_threshold_minutes: Math.round(parsed.data.overtimeThresholdHours * 60),
      notifications_enabled: parsed.data.notificationsEnabled,
    },
    { onConflict: "user_id" }
  );

  if (error) {
    return { error: m.errors.preferencesSaveFailed };
  }

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function updateTaxSettingsAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const { m } = await getI18n();
  const parsed = taxSettingsSchema.safeParse({
    taxCountry: formText(formData, "taxCountry"),
    taxRegion: formText(formData, "taxRegion"),
    taxCity: formText(formData, "taxCity"),
  });

  if (!parsed.success) {
    return { error: validationMessage(m, parsed.error) };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: m.errors.mustSignIn };

  const { error } = await supabase.from("user_settings").upsert(
    {
      user_id: user.id,
      tax_country: parsed.data.taxCountry || null,
      tax_region: parsed.data.taxRegion || null,
      tax_city: parsed.data.taxCity || null,
    },
    { onConflict: "user_id" }
  );

  if (error) {
    return { error: m.errors.taxSaveFailed };
  }

  revalidatePath("/settings");
  revalidatePath("/taxes");
  return { success: true };
}

export async function deleteAccountAction(): Promise<ActionResult> {
  const { m } = await getI18n();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: m.errors.mustSignIn };

  await logAudit({ userId: user.id, entityType: "account", entityId: user.id, action: "deleted" });

  try {
    // Stop anything that would outlive the account: a live Stripe
    // subscription would keep charging, and a linked bank would keep
    // syncing at Plaid. Best effort -- deletion proceeds regardless.
    await cancelSubscriptionForDeletedAccount(user.id);
    await revokeBankItems(user.id);

    const admin = createAdminClient();
    // Storage files don't cascade with the user row: remove receipts and the profile photo too.
    const [{ data: files }, { data: profileRow }] = await Promise.all([
      admin.from("attachments").select("storage_path").eq("user_id", user.id),
      admin.from("profiles").select("avatar_url").eq("id", user.id).maybeSingle(),
    ]);
    const paths = [...(files ?? []).map((f) => f.storage_path), ...(profileRow?.avatar_url ? [profileRow.avatar_url] : [])];
    if (paths.length > 0) await admin.storage.from(ATTACHMENTS_BUCKET).remove(paths);

    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) throw error;
  } catch (error) {
    // Including a missing admin key: report it rather than crash the page.
    console.error("Account deletion failed", error);
    return { error: m.errors.accountDeleteFailed };
  }

  await supabase.auth.signOut();
  redirect("/login");
}

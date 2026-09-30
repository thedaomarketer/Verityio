"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getI18n, setLocaleCookie } from "@/lib/i18n/server";
import { isLocale } from "@/lib/i18n/config";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { clearPushDeviceId, getPushDeviceId } from "@/lib/push/device-cookie";
import { validationMessage } from "@/lib/i18n/validation";
import {
  requestPasswordResetSchema,
  signInSchema,
  signUpSchema,
  updatePasswordSchema,
} from "@/lib/validation/auth";

export interface ActionResult {
  error?: string;
}

function getOrigin(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

export async function signUpAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const { m } = await getI18n();
  const parsed = signUpSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
    timezone: formData.get("timezone") ?? undefined,
    locale: formData.get("locale") ?? undefined,
  });

  if (!parsed.success) {
    return { error: validationMessage(m, parsed.error) };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      // Read by the handle_new_user() trigger to seed the profile.
      data: {
        full_name: parsed.data.fullName,
        ...(parsed.data.timezone && { timezone: parsed.data.timezone }),
        ...(parsed.data.locale && { locale: parsed.data.locale }),
      },
      emailRedirectTo: `${getOrigin()}/auth/confirm`,
    },
  });

  if (error) {
    return { error: error.message };
  }

  redirect("/login?registered=1");
}

export async function signInAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const { m } = await getI18n();
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: validationMessage(m, parsed.error) };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return { error: m.errors.badCredentials };
  }

  await syncLocaleCookie(supabase, data.user.id);
  redirect(safeRedirectPath(formData.get("redirectTo"), "/dashboard"));
}

/** Switches the UI to the language saved on the profile (it follows the account across devices). */
async function syncLocaleCookie(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data: profile } = await supabase.from("profiles").select("locale").eq("id", userId).maybeSingle();
  if (isLocale(profile?.locale)) await setLocaleCookie(profile.locale);
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();

  // Stop this device receiving the account's reminders once signed out
  // (it may be shared). RLS limits the delete to the caller's own rows.
  const pushDeviceId = await getPushDeviceId();
  if (pushDeviceId) {
    await supabase.from("push_subscriptions").delete().eq("onesignal_id", pushDeviceId);
    await clearPushDeviceId();
  }

  await supabase.auth.signOut();
  redirect("/login");
}

export async function requestPasswordResetAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const { m } = await getI18n();
  const parsed = requestPasswordResetSchema.safeParse({
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return { error: validationMessage(m, parsed.error) };
  }

  const supabase = await createClient();
  // Always report success regardless of whether the email exists, so we
  // don't leak account existence.
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${getOrigin()}/update-password`,
  });

  return {};
}

export async function updatePasswordAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const { m } = await getI18n();
  const parsed = updatePasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { error: validationMessage(m, parsed.error) };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });

  if (error) {
    return { error: error.message };
  }

  redirect("/dashboard");
}

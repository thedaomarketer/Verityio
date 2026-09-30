"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getI18n } from "@/lib/i18n/server";
import { isPushConfigured, sendPush } from "@/lib/push/onesignal";
import { clearPushDeviceId, getPushDeviceId, setPushDeviceId } from "@/lib/push/device-cookie";

export interface PushActionResult {
  error?: string;
  success?: boolean;
}

const subscriptionSchema = z.object({
  subscriptionId: z.uuid(),
  userAgent: z.string().max(512).optional(),
});

/**
 * Links this browser's OneSignal subscription to the signed-in account.
 * The session is verified first; the write then uses the admin client because
 * a subscription id can move between accounts on a shared device, which RLS
 * (rightly) won't let one user do to another user's row.
 */
export async function savePushSubscriptionAction(subscriptionId: string, userAgent?: string): Promise<PushActionResult> {
  const { m } = await getI18n();
  if (!isPushConfigured()) return { error: m.errors.pushNotConfigured };

  const parsed = subscriptionSchema.safeParse({ subscriptionId, userAgent });
  if (!parsed.success) return { error: m.errors.pushSaveFailed };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: m.errors.mustSignIn };

  try {
    const { error } = await createAdminClient()
      .from("push_subscriptions")
      .upsert(
        {
          user_id: user.id,
          onesignal_id: parsed.data.subscriptionId,
          user_agent: parsed.data.userAgent ?? null,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: "onesignal_id" }
      );
    if (error) throw error;
  } catch (error) {
    console.error("Saving push subscription failed", error);
    return { error: m.errors.pushSaveFailed };
  }

  await setPushDeviceId(parsed.data.subscriptionId);
  revalidatePath("/settings");
  return { success: true };
}

/** Unlinks this browser's subscription (RLS scopes the delete to the caller's own rows). */
export async function removePushSubscriptionAction(): Promise<PushActionResult> {
  const { m } = await getI18n();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: m.errors.mustSignIn };

  const deviceId = await getPushDeviceId();
  if (deviceId) {
    await supabase.from("push_subscriptions").delete().eq("onesignal_id", deviceId).eq("user_id", user.id);
  }
  await clearPushDeviceId();
  revalidatePath("/settings");
  return { success: true };
}

/** Sends a test notification to this device, at most once a minute. */
export async function sendTestNotificationAction(): Promise<PushActionResult> {
  const { m } = await getI18n();
  if (!isPushConfigured()) return { error: m.errors.pushNotConfigured };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: m.errors.mustSignIn };

  const deviceId = await getPushDeviceId();
  const { data: subscription } = deviceId
    ? await supabase
        .from("push_subscriptions")
        .select("onesignal_id")
        .eq("onesignal_id", deviceId)
        .eq("user_id", user.id)
        .maybeSingle()
    : { data: null };
  if (!subscription) return { error: m.errors.pushNoDevice };

  try {
    // Rate limit: one test per minute, recorded like any other delivery.
    const minute = new Date().toISOString().slice(0, 16);
    const { data: claimed, error } = await createAdminClient()
      .from("notification_deliveries")
      .upsert(
        { user_id: user.id, kind: "test", dedupe_key: `test:${minute}` },
        { onConflict: "user_id,dedupe_key", ignoreDuplicates: true }
      )
      .select("id");
    if (error) throw error;
    if (!claimed || claimed.length === 0) return { error: m.errors.pushTooSoon };
  } catch (error) {
    console.error("Recording test notification failed", error);
    return { error: m.errors.pushSendFailed };
  }

  const sent = await sendPush({
    subscriptionIds: [subscription.onesignal_id],
    title: m.notifications.testTitle,
    body: m.notifications.testBody,
    path: "/settings",
    idempotencyKey: randomUUID(),
  });
  return sent ? { success: true } : { error: m.errors.pushSendFailed };
}

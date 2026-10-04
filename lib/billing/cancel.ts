import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { statusGrantsPremium, isSubscriptionStatus } from "./entitlements";
import { cancelSubscriptionNow, isBillingConfigured } from "./stripe";

/**
 * Cancels a deleted account's subscription immediately, so nobody is billed
 * for an account that no longer exists. Best effort: failures are logged.
 */
export async function cancelSubscriptionForDeletedAccount(userId: string): Promise<void> {
  if (!isBillingConfigured()) return;
  const { data } = await createAdminClient()
    .from("subscriptions")
    .select("stripe_subscription_id, status")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data?.stripe_subscription_id || !isSubscriptionStatus(data.status) || !statusGrantsPremium(data.status)) return;
  try {
    await cancelSubscriptionNow(data.stripe_subscription_id);
  } catch (error) {
    console.error("Cancelling subscription on account deletion failed", error instanceof Error ? error.message : error);
  }
}

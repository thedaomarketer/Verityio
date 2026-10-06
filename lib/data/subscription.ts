import "server-only";

import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import { effectiveTier, isSubscriptionStatus, statusGrantsPremium, type SubscriptionStatus } from "@/lib/billing/entitlements";
import { isPaidTier, tierIncludes, type BillingInterval, type PaidFeature, type PaidTier, type Tier } from "@/lib/billing/plans";
import { isBillingConfigured } from "@/lib/billing/stripe";

export interface Entitlement {
  /** The tier whose features are open to this user right now. */
  tier: Tier;
  /** Whether Stripe billing is switched on at all (keys present). */
  billingEnabled: boolean;
  /** A subscription Stripe still counts as good (active, trialing, past due). */
  subscribed: boolean;
  /** The tier paid for, even if the subscription has lapsed. */
  subscribedTier: PaidTier | null;
  status: SubscriptionStatus;
  interval: BillingInterval | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  hasCustomer: boolean;
  /** Ever had a subscription (so no second free trial). */
  hadSubscription: boolean;
}

/**
 * The signed-in user's plan, read through RLS (a user can only ever see
 * their own row). Cached per request so a page and its gates share one
 * query. Fails closed: if billing is on but the row can't be read, the user
 * is treated as free rather than granted a paid tier.
 */
export const getEntitlement = cache(async (userId: string): Promise<Entitlement> => {
  const billingEnabled = isBillingConfigured();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("subscriptions")
    .select("status, plan_interval, plan_tier, current_period_end, cancel_at_period_end, stripe_customer_id, stripe_subscription_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error && billingEnabled) console.error("Could not read subscription", error.message);

  const status: SubscriptionStatus = !error && data && isSubscriptionStatus(data.status) ? data.status : "none";
  const subscribedTier = isPaidTier(data?.plan_tier) ? data.plan_tier : null;
  return {
    tier: effectiveTier(billingEnabled, status, subscribedTier),
    billingEnabled,
    subscribed: statusGrantsPremium(status),
    subscribedTier,
    status,
    interval: data?.plan_interval ?? null,
    currentPeriodEnd: data?.current_period_end ?? null,
    cancelAtPeriodEnd: data?.cancel_at_period_end ?? false,
    hasCustomer: Boolean(data?.stripe_customer_id),
    hadSubscription: Boolean(data?.stripe_subscription_id),
  };
});

/** Whether the signed-in user's plan includes a paid feature. */
export async function hasFeature(userId: string, feature: PaidFeature): Promise<boolean> {
  return tierIncludes((await getEntitlement(userId)).tier, feature);
}

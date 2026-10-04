import "server-only";

import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import { hasPremiumAccess, isSubscriptionStatus, type SubscriptionStatus } from "@/lib/billing/entitlements";
import { isBillingConfigured } from "@/lib/billing/stripe";

export interface Entitlement {
  /** Whether Premium features are open to this user right now. */
  premium: boolean;
  /** Whether Stripe billing is switched on at all (keys present). */
  billingEnabled: boolean;
  status: SubscriptionStatus;
  interval: "month" | "year" | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  hasCustomer: boolean;
}

/**
 * The signed-in user's Premium entitlement, read through RLS (a user can
 * only ever see their own row). Cached per request so a page and its gates
 * share one query. Fails closed: if billing is on but the row can't be read,
 * the user is treated as free rather than granted Premium.
 */
export const getEntitlement = cache(async (userId: string): Promise<Entitlement> => {
  const billingEnabled = isBillingConfigured();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("subscriptions")
    .select("status, plan_interval, current_period_end, cancel_at_period_end, stripe_customer_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error && billingEnabled) console.error("Could not read subscription", error.message);

  const status: SubscriptionStatus = data && isSubscriptionStatus(data.status) ? data.status : "none";
  return {
    premium: hasPremiumAccess(billingEnabled, error ? "none" : status),
    billingEnabled,
    status,
    interval: data?.plan_interval ?? null,
    currentPeriodEnd: data?.current_period_end ?? null,
    cancelAtPeriodEnd: data?.cancel_at_period_end ?? false,
    hasCustomer: Boolean(data?.stripe_customer_id),
  };
});

"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getI18n } from "@/lib/i18n/server";
import { isBillingInterval, isPaidTier } from "@/lib/billing/plans";
import { isProAvailable } from "@/lib/billing/availability";
import { createCheckoutSession, createPortalSession, isBillingConfigured } from "@/lib/billing/stripe";

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

/**
 * Starts Stripe Checkout for the chosen tier and interval. The price comes
 * from lib/billing/plans.ts on the server -- the form only names a tier and
 * an interval, so the amount can't be tampered with. A first subscription
 * starts with a free trial. The tier is granted later, by the signed
 * webhook, never by returning to the success URL.
 */
export async function startCheckoutAction(formData: FormData): Promise<void> {
  const tier = formData.get("tier");
  const interval = formData.get("interval");
  if (!isPaidTier(tier) || !isBillingInterval(interval) || !isBillingConfigured()) redirect("/premium?error=checkout");
  // Pro can't be bought until one of its features works for real.
  if (tier === "pro" && !isProAvailable()) redirect("/premium?error=checkout");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirectTo=/premium");

  const [{ locale }, { data: subscription }] = await Promise.all([
    getI18n(),
    supabase
      .from("subscriptions")
      .select("stripe_customer_id, stripe_subscription_id, status")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);
  // Already subscribed: manage it instead of opening a second subscription.
  if (subscription && ["active", "trialing", "past_due"].includes(subscription.status)) redirect("/premium");

  let url: string;
  try {
    url = await createCheckoutSession({
      tier,
      interval,
      userId: user.id,
      email: user.email ?? null,
      customerId: subscription?.stripe_customer_id ?? null,
      trial: !subscription?.stripe_subscription_id,
      successUrl: `${siteUrl()}/premium?checkout=success`,
      cancelUrl: `${siteUrl()}/premium?checkout=cancelled`,
      locale,
    });
  } catch (error) {
    console.error("Stripe checkout failed", error instanceof Error ? error.message : error);
    redirect("/premium?error=checkout");
  }
  redirect(url);
}

/** Opens Stripe's billing portal: payment method, invoices, billing details, or cancel. */
export async function openBillingPortalAction(): Promise<void> {
  if (!isBillingConfigured()) redirect("/premium?error=portal");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirectTo=/premium");

  // Read with the admin client only after the session is verified: the row is the user's own.
  const { data } = await createAdminClient()
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!data?.stripe_customer_id) redirect("/premium");

  const { locale } = await getI18n();
  let url: string;
  try {
    url = await createPortalSession({
      customerId: data.stripe_customer_id,
      returnUrl: `${siteUrl()}/premium`,
      locale,
      tiers: isProAvailable() ? ["plus", "pro"] : ["plus"],
    });
  } catch (error) {
    console.error("Stripe portal failed", error instanceof Error ? error.message : error);
    redirect("/premium?error=portal");
  }
  redirect(url);
}

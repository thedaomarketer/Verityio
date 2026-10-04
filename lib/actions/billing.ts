"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getI18n } from "@/lib/i18n/server";
import { isPlanId } from "@/lib/billing/plans";
import { createCheckoutSession, createPortalSession, isBillingConfigured } from "@/lib/billing/stripe";

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

/**
 * Starts Stripe Checkout for the chosen plan. The price comes from
 * lib/billing/plans.ts on the server -- the form only says "monthly" or
 * "yearly", so the amount can't be tampered with. Premium is granted later,
 * by the signed webhook, never by returning to the success URL.
 */
export async function startCheckoutAction(formData: FormData): Promise<void> {
  const plan = formData.get("plan");
  if (!isPlanId(plan) || !isBillingConfigured()) redirect("/premium?error=checkout");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirectTo=/premium");

  const [{ locale }, { data: subscription }] = await Promise.all([
    getI18n(),
    supabase.from("subscriptions").select("stripe_customer_id, status").eq("user_id", user.id).maybeSingle(),
  ]);
  // Already subscribed: manage it instead of opening a second subscription.
  if (subscription && ["active", "trialing", "past_due"].includes(subscription.status)) redirect("/premium");

  let url: string;
  try {
    url = await createCheckoutSession({
      planId: plan,
      userId: user.id,
      email: user.email ?? null,
      customerId: subscription?.stripe_customer_id ?? null,
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

/** Opens Stripe's billing portal to change plan, update a card, or cancel. */
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
    url = await createPortalSession(data.stripe_customer_id, `${siteUrl()}/premium`, locale);
  } catch (error) {
    console.error("Stripe portal failed", error instanceof Error ? error.message : error);
    redirect("/premium?error=portal");
  }
  redirect(url);
}

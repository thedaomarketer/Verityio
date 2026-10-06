import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { verifyStripeSignature } from "@/lib/billing/stripe-signature";
import {
  getStripeWebhookSecret,
  isBillingConfigured,
  parseSubscription,
  retrieveSubscription,
  type StripeSubscription,
} from "@/lib/billing/stripe";

const eventSchema = z.object({
  id: z.string(),
  type: z.string(),
  data: z.object({ object: z.record(z.string(), z.unknown()) }),
});

const checkoutSessionSchema = z.object({
  client_reference_id: z.string().uuid().nullish(),
  customer: z.string().nullish(),
  subscription: z.string().nullish(),
  mode: z.string(),
});

async function saveSubscription(subscription: StripeSubscription, fallbackUserId?: string | null) {
  const admin = createAdminClient();
  let userId = subscription.userId ?? fallbackUserId ?? null;
  if (!userId) {
    const { data } = await admin
      .from("subscriptions")
      .select("user_id")
      .eq("stripe_customer_id", subscription.customerId)
      .maybeSingle();
    userId = data?.user_id ?? null;
  }
  if (!userId) {
    console.error("Stripe subscription with no Verityio user", subscription.id);
    return;
  }

  const { error } = await admin.from("subscriptions").upsert(
    {
      user_id: userId,
      stripe_customer_id: subscription.customerId,
      stripe_subscription_id: subscription.id,
      status: subscription.status,
      plan_interval: subscription.interval,
      plan_tier: subscription.tier,
      current_period_end: subscription.currentPeriodEnd?.toISOString() ?? null,
      cancel_at_period_end: subscription.cancelAtPeriodEnd,
    },
    { onConflict: "user_id" }
  );
  if (error) throw new Error(`Could not save subscription: ${error.message}`);
}

/**
 * Stripe webhook: the only way a paid tier is ever granted. The signature is
 * checked against the raw body before anything is parsed; subscription
 * state is then re-read from Stripe (never trusted from the event
 * snapshot, which can arrive out of order) and written with the service-role client.
 *
 * Subscribe the endpoint to: checkout.session.completed,
 * customer.subscription.created, customer.subscription.updated,
 * customer.subscription.deleted.
 */
export async function POST(request: NextRequest) {
  const secret = getStripeWebhookSecret();
  if (!secret || !isBillingConfigured()) {
    return NextResponse.json({ error: "Billing is not configured" }, { status: 503 });
  }

  const payload = await request.text();
  if (!verifyStripeSignature(payload, request.headers.get("stripe-signature"), secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = JSON.parse(payload);
  } catch {
    return NextResponse.json({ error: "Malformed event" }, { status: 400 });
  }
  const event = eventSchema.safeParse(body);
  if (!event.success) return NextResponse.json({ error: "Malformed event" }, { status: 400 });

  try {
    const { type, data } = event.data;
    if (type === "checkout.session.completed") {
      const session = checkoutSessionSchema.safeParse(data.object);
      if (session.success && session.data.mode === "subscription" && session.data.subscription) {
        const subscription = await retrieveSubscription(session.data.subscription);
        await saveSubscription(subscription, session.data.client_reference_id);
      }
    } else if (type.startsWith("customer.subscription.")) {
      // Events can arrive out of order, so re-read the subscription's current state instead of the snapshot.
      const snapshot = parseSubscription(data.object);
      if (snapshot) await saveSubscription(await retrieveSubscription(snapshot.id), snapshot.userId);
    }
  } catch (error) {
    console.error("Stripe webhook failed", event.data.type, error instanceof Error ? error.message : error);
    // A 500 makes Stripe retry later.
    return NextResponse.json({ error: "Webhook handling failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

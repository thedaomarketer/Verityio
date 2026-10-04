import "server-only";

import { z } from "zod";

import { stripeFormEncode, type FormValue } from "./form-encode";
import { PLANS, PREMIUM_CURRENCY, PREMIUM_PRODUCT_ID, type PlanId } from "./plans";
import { isSubscriptionStatus, type SubscriptionStatus } from "./entitlements";

/**
 * Minimal server-side Stripe client over `fetch` (no SDK). Configuration:
 * - STRIPE_SECRET_KEY: the account's secret (or restricted) key. Server-only.
 * - STRIPE_WEBHOOK_SECRET: the webhook endpoint's signing secret (whsec_...).
 * Without both, billing is "not switched on": the Premium page says so and
 * every Premium feature stays open (see `hasPremiumAccess`).
 */

const STRIPE_API = "https://api.stripe.com/v1";
const TIMEOUT_MS = 10_000;

function secretKey(): string | null {
  return process.env.STRIPE_SECRET_KEY?.trim() || null;
}

export function getStripeWebhookSecret(): string | null {
  return process.env.STRIPE_WEBHOOK_SECRET?.trim() || null;
}

export function isBillingConfigured(): boolean {
  return Boolean(secretKey() && getStripeWebhookSecret());
}

export class StripeError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

async function stripeRequest<T>(
  method: "GET" | "POST" | "DELETE",
  path: string,
  schema: z.ZodType<T>,
  params?: Record<string, FormValue>,
  idempotencyKey?: string
): Promise<T> {
  const key = secretKey();
  if (!key) throw new StripeError("Stripe is not configured", 503);

  const query = method === "GET" && params ? `?${stripeFormEncode(params)}` : "";
  const response = await fetch(`${STRIPE_API}${path}${query}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body: method !== "GET" && params ? stripeFormEncode(params) : undefined,
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });

  const json: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    // Stripe's error message is safe to log (never contains the key).
    const message = z.object({ error: z.object({ message: z.string() }) }).safeParse(json);
    throw new StripeError(message.success ? message.data.error.message : `Stripe ${response.status}`, response.status);
  }
  return schema.parse(json);
}

const idSchema = z.object({ id: z.string() });
const priceListSchema = z.object({ data: z.array(z.object({ id: z.string(), unit_amount: z.number().nullable() })) });
const urlSchema = z.object({ url: z.string().url() });

const subscriptionSchema = z.object({
  id: z.string(),
  customer: z.union([z.string(), z.object({ id: z.string() })]),
  status: z.string(),
  cancel_at_period_end: z.boolean().optional().default(false),
  // Top-level on older API versions; on each item since 2025-03-31.
  current_period_end: z.number().nullish(),
  metadata: z.record(z.string(), z.string()).optional().default({}),
  items: z.object({
    data: z.array(
      z.object({
        current_period_end: z.number().nullish(),
        price: z.object({ recurring: z.object({ interval: z.string() }).nullish() }),
      })
    ),
  }),
});

export interface StripeSubscription {
  id: string;
  customerId: string;
  status: SubscriptionStatus;
  interval: "month" | "year" | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  userId: string | null;
}

function toSubscription(raw: z.infer<typeof subscriptionSchema>): StripeSubscription {
  const item = raw.items.data[0];
  const interval = item?.price.recurring?.interval;
  const periodEnd = raw.current_period_end ?? item?.current_period_end ?? null;
  return {
    id: raw.id,
    customerId: typeof raw.customer === "string" ? raw.customer : raw.customer.id,
    status: isSubscriptionStatus(raw.status) ? raw.status : "none",
    interval: interval === "month" || interval === "year" ? interval : null,
    currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
    cancelAtPeriodEnd: raw.cancel_at_period_end,
    userId: raw.metadata.user_id ?? null,
  };
}

export async function retrieveSubscription(id: string): Promise<StripeSubscription> {
  return toSubscription(await stripeRequest("GET", `/subscriptions/${encodeURIComponent(id)}`, subscriptionSchema));
}

export async function cancelSubscriptionNow(id: string): Promise<void> {
  await stripeRequest("DELETE", `/subscriptions/${encodeURIComponent(id)}`, idSchema);
}

/** Parses a subscription object straight out of a webhook event. */
export function parseSubscription(raw: unknown): StripeSubscription | null {
  const parsed = subscriptionSchema.safeParse(raw);
  return parsed.success ? toSubscription(parsed.data) : null;
}

const priceCache = new Map<PlanId, string>();

/**
 * The Stripe price for a plan, found by lookup key -- or, on a brand-new
 * Stripe account, created along with the "Verityio Premium" product, so the
 * only setup is adding the keys.
 */
async function getPriceId(planId: PlanId): Promise<string> {
  const cached = priceCache.get(planId);
  if (cached) return cached;
  const plan = PLANS[planId];

  const existing = await stripeRequest("GET", "/prices", priceListSchema, {
    lookup_keys: [plan.lookupKey],
    active: true,
    limit: 1,
  });
  let priceId = existing.data[0]?.id;

  if (!priceId) {
    try {
      await stripeRequest("GET", `/products/${PREMIUM_PRODUCT_ID}`, idSchema);
    } catch (error) {
      if (!(error instanceof StripeError) || error.status !== 404) throw error;
      await stripeRequest(
        "POST",
        "/products",
        idSchema,
        { id: PREMIUM_PRODUCT_ID, name: "Verityio Premium" },
        `product-${PREMIUM_PRODUCT_ID}`
      );
    }
    const created = await stripeRequest(
      "POST",
      "/prices",
      idSchema,
      {
        product: PREMIUM_PRODUCT_ID,
        currency: PREMIUM_CURRENCY,
        unit_amount: plan.amountCents,
        recurring: { interval: plan.interval },
        lookup_key: plan.lookupKey,
      },
      `price-${plan.lookupKey}`
    );
    priceId = created.id;
  }

  priceCache.set(planId, priceId);
  return priceId;
}

export async function createCheckoutSession(input: {
  planId: PlanId;
  userId: string;
  email: string | null;
  customerId: string | null;
  successUrl: string;
  cancelUrl: string;
  locale: string;
}): Promise<string> {
  const price = await getPriceId(input.planId);
  const session = await stripeRequest("POST", "/checkout/sessions", urlSchema, {
    mode: "subscription",
    line_items: [{ price, quantity: 1 }],
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    client_reference_id: input.userId,
    customer: input.customerId ?? undefined,
    customer_email: input.customerId ? undefined : (input.email ?? undefined),
    subscription_data: { metadata: { user_id: input.userId } },
    allow_promotion_codes: true,
    locale: input.locale,
  });
  return session.url;
}

export async function createPortalSession(customerId: string, returnUrl: string, locale: string): Promise<string> {
  const session = await stripeRequest("POST", "/billing_portal/sessions", urlSchema, {
    customer: customerId,
    return_url: returnUrl,
    locale,
  });
  return session.url;
}

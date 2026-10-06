import "server-only";

import { z } from "zod";

import { stripeFormEncode, type FormValue } from "./form-encode";
import { PRICES, PREMIUM_CURRENCY, TIER_PRODUCTS, TRIAL_DAYS, tierForLookupKey, type BillingInterval, type PaidTier } from "./plans";
import { isSubscriptionStatus, type SubscriptionStatus } from "./entitlements";

/**
 * Minimal server-side Stripe client over `fetch` (no SDK). Configuration:
 * - STRIPE_SECRET_KEY: the account's secret (or restricted) key. Server-only.
 * - STRIPE_WEBHOOK_SECRET: the webhook endpoint's signing secret (whsec_...).
 * Without both, billing is "not switched on": the Premium page says so and
 * every paid feature stays open (see `effectiveTier`).
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
        price: z.object({
          lookup_key: z.string().nullish(),
          recurring: z.object({ interval: z.string() }).nullish(),
        }),
      })
    ),
  }),
});

export interface StripeSubscription {
  id: string;
  customerId: string;
  status: SubscriptionStatus;
  interval: BillingInterval | null;
  /** The Verityio tier of the subscribed price; null for a price Verityio doesn't sell. */
  tier: PaidTier | null;
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
    tier: tierForLookupKey(item?.price.lookup_key),
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

const priceCache = new Map<string, string>();

/**
 * The Stripe price for a tier and interval, found by lookup key -- or, on a
 * brand-new Stripe account, created along with the tier's product, so the
 * only setup is adding the keys.
 */
async function getPriceId(tier: PaidTier, interval: BillingInterval): Promise<string> {
  const price = PRICES[tier][interval];
  const cached = priceCache.get(price.lookupKey);
  if (cached) return cached;
  const product = TIER_PRODUCTS[tier];

  const existing = await stripeRequest("GET", "/prices", priceListSchema, {
    lookup_keys: [price.lookupKey],
    active: true,
    limit: 1,
  });
  let priceId = existing.data[0]?.id;

  if (!priceId) {
    try {
      await stripeRequest("GET", `/products/${product.productId}`, idSchema);
    } catch (error) {
      if (!(error instanceof StripeError) || error.status !== 404) throw error;
      await stripeRequest(
        "POST",
        "/products",
        idSchema,
        { id: product.productId, name: product.name },
        `product-${product.productId}`
      );
    }
    const created = await stripeRequest(
      "POST",
      "/prices",
      idSchema,
      {
        product: product.productId,
        currency: PREMIUM_CURRENCY,
        unit_amount: price.amountCents,
        recurring: { interval: price.interval },
        lookup_key: price.lookupKey,
      },
      `price-${price.lookupKey}`
    );
    priceId = created.id;
  }

  priceCache.set(price.lookupKey, priceId);
  return priceId;
}

export async function createCheckoutSession(input: {
  tier: PaidTier;
  interval: BillingInterval;
  userId: string;
  email: string | null;
  customerId: string | null;
  /** First subscription only: starts with a free trial. */
  trial: boolean;
  successUrl: string;
  cancelUrl: string;
  locale: string;
}): Promise<string> {
  const price = await getPriceId(input.tier, input.interval);
  const session = await stripeRequest("POST", "/checkout/sessions", urlSchema, {
    mode: "subscription",
    line_items: [{ price, quantity: 1 }],
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    client_reference_id: input.userId,
    customer: input.customerId ?? undefined,
    customer_email: input.customerId ? undefined : (input.email ?? undefined),
    // Always save a payment method, even during a free trial, so the plan simply continues afterwards.
    payment_method_collection: "always",
    subscription_data: {
      metadata: { user_id: input.userId },
      trial_period_days: input.trial ? TRIAL_DAYS : undefined,
    },
    allow_promotion_codes: true,
    locale: input.locale,
  });
  return session.url;
}

const portalConfigListSchema = z.object({
  data: z.array(z.object({ id: z.string(), active: z.boolean(), metadata: z.record(z.string(), z.string()).nullish() })),
});
const portalConfigIds = new Map<string, string>();

/**
 * Verityio's own billing-portal configuration: update the payment method,
 * see and download invoices, update billing details, switch between the
 * tiers on sale (prorated), and cancel at the end of the paid period.
 * Created through the API the first time, so the portal works without
 * anyone setting it up in the Stripe dashboard (Stripe refuses portal
 * sessions in live mode until a configuration exists). One configuration
 * per set of tiers on sale, so Pro joins the switcher once it opens.
 */
async function getPortalConfigurationId(tiers: readonly PaidTier[]): Promise<string> {
  const key = tiers.join(",");
  const cached = portalConfigIds.get(key);
  if (cached) return cached;

  const existing = await stripeRequest("GET", "/billing_portal/configurations", portalConfigListSchema, {
    active: true,
    limit: 100,
  });
  let id = existing.data.find((config) => config.metadata?.app === "verityio" && config.metadata?.tiers === key)?.id;
  if (!id) {
    const products = await Promise.all(
      tiers.map(async (tier) => ({
        product: TIER_PRODUCTS[tier].productId,
        prices: await Promise.all([getPriceId(tier, "month"), getPriceId(tier, "year")]),
      }))
    );
    id = (
      await stripeRequest(
        "POST",
        "/billing_portal/configurations",
        idSchema,
        {
          business_profile: { headline: "Manage your Verityio plan and payment method" },
          features: {
            payment_method_update: { enabled: true },
            invoice_history: { enabled: true },
            customer_update: { enabled: true, allowed_updates: ["email", "address"] },
            subscription_cancel: { enabled: true, mode: "at_period_end" },
            subscription_update: {
              enabled: true,
              default_allowed_updates: ["price"],
              proration_behavior: "create_prorations",
              products,
            },
          },
          metadata: { app: "verityio", tiers: key },
        },
        `portal-config-verityio-v1-${key}`
      )
    ).id;
  }
  portalConfigIds.set(key, id);
  return id;
}

export async function createPortalSession(input: {
  customerId: string;
  returnUrl: string;
  locale: string;
  /** Tiers a subscriber may switch between in the portal. */
  tiers: readonly PaidTier[];
}): Promise<string> {
  const session = await stripeRequest("POST", "/billing_portal/sessions", urlSchema, {
    customer: input.customerId,
    configuration: await getPortalConfigurationId(input.tiers),
    return_url: input.returnUrl,
    locale: input.locale,
  });
  return session.url;
}

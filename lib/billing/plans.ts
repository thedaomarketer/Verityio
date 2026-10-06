/**
 * Verityio pricing, in integer cents -- the single source of truth (see
 * docs/pricing.md for how these were chosen). Stripe prices are found, or
 * created on first checkout, by `lookupKey`, so to change a price edit it
 * here and bump its lookup key; existing subscribers keep the old price.
 */

export type PaidTier = "plus" | "pro";
export type Tier = "free" | PaidTier;
export type BillingInterval = "month" | "year";

export interface Price {
  tier: PaidTier;
  interval: BillingInterval;
  amountCents: number;
  lookupKey: string;
}

export const PREMIUM_CURRENCY = "usd";

/** First-time subscribers get this many days free (card collected up front by Checkout). */
export const TRIAL_DAYS = 7;

export const TIER_PRODUCTS: Record<PaidTier, { productId: string; name: string }> = {
  plus: { productId: "verityio_plus", name: "Verityio Plus" },
  pro: { productId: "verityio_pro", name: "Verityio Pro" },
};

export const PRICES: Record<PaidTier, Record<BillingInterval, Price>> = {
  plus: {
    month: { tier: "plus", interval: "month", amountCents: 499, lookupKey: "verityio_plus_monthly_499" },
    year: { tier: "plus", interval: "year", amountCents: 3999, lookupKey: "verityio_plus_yearly_3999" },
  },
  pro: {
    month: { tier: "pro", interval: "month", amountCents: 999, lookupKey: "verityio_pro_monthly_999" },
    year: { tier: "pro", interval: "year", amountCents: 7999, lookupKey: "verityio_pro_yearly_7999" },
  },
};

/** Lookup keys from the original single "Premium" plan. They included everything, so they map to Pro. */
const LEGACY_LOOKUP_KEYS: Record<string, PaidTier> = {
  verityio_premium_monthly_299: "pro",
  verityio_premium_yearly_2999: "pro",
};

/** Which paid tier a Stripe price belongs to, from its lookup key; null for a price Verityio doesn't sell. */
export function tierForLookupKey(lookupKey: string | null | undefined): PaidTier | null {
  if (!lookupKey) return null;
  for (const tier of ["plus", "pro"] as const) {
    if (PRICES[tier].month.lookupKey === lookupKey || PRICES[tier].year.lookupKey === lookupKey) return tier;
  }
  return LEGACY_LOOKUP_KEYS[lookupKey] ?? null;
}

export function isPaidTier(value: unknown): value is PaidTier {
  return value === "plus" || value === "pro";
}

export function isBillingInterval(value: unknown): value is BillingInterval {
  return value === "month" || value === "year";
}

/** Whole-percent saving of a yearly price over twelve monthly payments, rounded down. */
export function yearlySavingsPercent(tier: PaidTier): number {
  const twelveMonths = PRICES[tier].month.amountCents * 12;
  if (twelveMonths <= 0) return 0;
  return Math.max(0, Math.floor(((twelveMonths - PRICES[tier].year.amountCents) * 100) / twelveMonths));
}

/** A yearly price spread over 12 months, rounded to the nearest cent (for display only). */
export function yearlyMonthlyEquivalentCents(tier: PaidTier): number {
  return Math.round(PRICES[tier].year.amountCents / 12);
}

/** Features that need a paid tier, and the lowest tier that includes each. */
export const FEATURE_TIER = {
  reports: "plus",
  budget: "plus",
  receiptScan: "plus",
  bank: "pro",
  assistant: "pro",
} as const satisfies Record<string, PaidTier>;

export type PaidFeature = keyof typeof FEATURE_TIER;

const TIER_RANK: Record<Tier, number> = { free: 0, plus: 1, pro: 2 };

export function tierIncludes(tier: Tier, feature: PaidFeature): boolean {
  return TIER_RANK[tier] >= TIER_RANK[FEATURE_TIER[feature]];
}

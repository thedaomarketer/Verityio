/**
 * Verityio Premium pricing, in integer cents. The Stripe prices are found
 * (or created on first checkout) by `lookupKey`, so these numbers are the
 * single source of truth -- change them here and bump the lookup key.
 */

export type PlanId = "monthly" | "yearly";

export interface Plan {
  id: PlanId;
  interval: "month" | "year";
  amountCents: number;
  lookupKey: string;
}

export const PREMIUM_CURRENCY = "usd";
export const PREMIUM_PRODUCT_ID = "verityio_premium";

export const PLANS: Record<PlanId, Plan> = {
  monthly: { id: "monthly", interval: "month", amountCents: 299, lookupKey: "verityio_premium_monthly_299" },
  yearly: { id: "yearly", interval: "year", amountCents: 2999, lookupKey: "verityio_premium_yearly_2999" },
};

export function isPlanId(value: unknown): value is PlanId {
  return value === "monthly" || value === "yearly";
}

/** Whole-percent saving of the yearly plan over twelve monthly payments, rounded down. */
export function yearlySavingsPercent(plans: Record<PlanId, Plan> = PLANS): number {
  const twelveMonths = plans.monthly.amountCents * 12;
  if (twelveMonths <= 0) return 0;
  return Math.max(0, Math.floor(((twelveMonths - plans.yearly.amountCents) * 100) / twelveMonths));
}

/** The yearly price spread over 12 months, rounded to the nearest cent. */
export function yearlyMonthlyEquivalentCents(plans: Record<PlanId, Plan> = PLANS): number {
  return Math.round(plans.yearly.amountCents / 12);
}

/** The Premium-only features, in the order the upgrade page lists them. */
export const PREMIUM_FEATURES = ["bank", "budget", "assistant", "reports"] as const;
export type PremiumFeature = (typeof PREMIUM_FEATURES)[number];

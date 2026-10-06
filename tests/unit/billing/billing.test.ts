import { describe, expect, it } from "vitest";

import { effectiveTier, isSubscriptionStatus, statusGrantsPremium } from "@/lib/billing/entitlements";
import { stripeFormEncode } from "@/lib/billing/form-encode";
import {
  PRICES,
  isBillingInterval,
  isPaidTier,
  tierForLookupKey,
  tierIncludes,
  yearlyMonthlyEquivalentCents,
  yearlySavingsPercent,
} from "@/lib/billing/plans";
import { signStripePayload, verifyStripeSignature } from "@/lib/billing/stripe-signature";

describe("plans", () => {
  it("prices Plus at $4.99/$39.99 and Pro at $9.99/$79.99, in cents", () => {
    expect(PRICES.plus.month.amountCents).toBe(499);
    expect(PRICES.plus.year.amountCents).toBe(3999);
    expect(PRICES.pro.month.amountCents).toBe(999);
    expect(PRICES.pro.year.amountCents).toBe(7999);
  });

  it("makes each yearly price cheaper than twelve monthly payments", () => {
    for (const tier of ["plus", "pro"] as const) {
      expect(PRICES[tier].year.amountCents).toBeLessThan(PRICES[tier].month.amountCents * 12);
    }
    expect(yearlySavingsPercent("plus")).toBe(33);
    expect(yearlySavingsPercent("pro")).toBe(33);
    expect(yearlyMonthlyEquivalentCents("plus")).toBe(333);
    expect(yearlyMonthlyEquivalentCents("pro")).toBe(667);
  });

  it("gives every price its own lookup key", () => {
    const keys = Object.values(PRICES).flatMap((byInterval) => Object.values(byInterval).map((p) => p.lookupKey));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("maps Stripe lookup keys back to tiers, legacy Premium to Pro", () => {
    expect(tierForLookupKey(PRICES.plus.year.lookupKey)).toBe("plus");
    expect(tierForLookupKey(PRICES.pro.month.lookupKey)).toBe("pro");
    expect(tierForLookupKey("verityio_premium_monthly_299")).toBe("pro");
    expect(tierForLookupKey("someone_elses_price")).toBeNull();
    expect(tierForLookupKey(null)).toBeNull();
  });

  it("only accepts known tiers and intervals from forms", () => {
    expect(isPaidTier("plus")).toBe(true);
    expect(isPaidTier("pro")).toBe(true);
    expect(isPaidTier("free")).toBe(false);
    expect(isPaidTier("lifetime")).toBe(false);
    expect(isBillingInterval("year")).toBe(true);
    expect(isBillingInterval("week")).toBe(false);
  });

  it("puts each feature in the right tier", () => {
    expect(tierIncludes("free", "reports")).toBe(false);
    expect(tierIncludes("plus", "reports")).toBe(true);
    expect(tierIncludes("plus", "budget")).toBe(true);
    expect(tierIncludes("plus", "bank")).toBe(false);
    expect(tierIncludes("plus", "assistant")).toBe(false);
    expect(tierIncludes("pro", "bank")).toBe(true);
    expect(tierIncludes("pro", "reports")).toBe(true);
  });
});

describe("entitlements", () => {
  it("grants a paid tier for active, trialing and past-due subscriptions only", () => {
    expect(statusGrantsPremium("active")).toBe(true);
    expect(statusGrantsPremium("trialing")).toBe(true);
    expect(statusGrantsPremium("past_due")).toBe(true);
    for (const status of ["none", "canceled", "unpaid", "incomplete", "incomplete_expired", "paused"] as const) {
      expect(statusGrantsPremium(status)).toBe(false);
    }
    expect(statusGrantsPremium(null)).toBe(false);
  });

  it("keeps every feature open until billing is switched on", () => {
    expect(effectiveTier(false, "none", null)).toBe("pro");
  });

  it("uses the subscribed tier while the subscription is good, free otherwise", () => {
    expect(effectiveTier(true, "none", null)).toBe("free");
    expect(effectiveTier(true, "active", "plus")).toBe("plus");
    expect(effectiveTier(true, "trialing", "pro")).toBe("pro");
    expect(effectiveTier(true, "canceled", "pro")).toBe("free");
    // An active subscription to a price Verityio doesn't sell grants nothing.
    expect(effectiveTier(true, "active", null)).toBe("free");
  });

  it("recognises Stripe's statuses and nothing else", () => {
    expect(isSubscriptionStatus("active")).toBe(true);
    expect(isSubscriptionStatus("premium")).toBe(false);
    expect(isSubscriptionStatus(1)).toBe(false);
  });
});

describe("stripeFormEncode", () => {
  it("flattens nested objects and arrays into bracket notation", () => {
    expect(
      stripeFormEncode({
        mode: "subscription",
        line_items: [{ price: "price_1", quantity: 1 }],
        subscription_data: { metadata: { user_id: "u 1" } },
        customer: undefined,
        allow_promotion_codes: true,
      })
    ).toBe(
      "mode=subscription&line_items%5B0%5D%5Bprice%5D=price_1&line_items%5B0%5D%5Bquantity%5D=1" +
        "&subscription_data%5Bmetadata%5D%5Buser_id%5D=u%201&allow_promotion_codes=true"
    );
  });

  it("skips null and undefined values", () => {
    expect(stripeFormEncode({ a: null, b: undefined, c: "x" })).toBe("c=x");
  });
});

describe("verifyStripeSignature", () => {
  const secret = "whsec_test";
  const payload = JSON.stringify({ id: "evt_1", type: "customer.subscription.updated" });
  const now = 1_790_000_000_000;
  const timestamp = Math.floor(now / 1000);

  it("accepts a correctly signed, fresh payload", () => {
    expect(verifyStripeSignature(payload, signStripePayload(payload, secret, timestamp), secret, { now })).toBe(true);
  });

  it("accepts when any of several v1 signatures matches (secret rotation)", () => {
    const valid = signStripePayload(payload, secret, timestamp);
    const header = `t=${timestamp},v1=${"0".repeat(64)},${valid.split(",")[1]}`;
    expect(verifyStripeSignature(payload, header, secret, { now })).toBe(true);
  });

  it("rejects a tampered body, a wrong secret, or a missing header", () => {
    const header = signStripePayload(payload, secret, timestamp);
    expect(verifyStripeSignature(payload.replace("updated", "deleted"), header, secret, { now })).toBe(false);
    expect(verifyStripeSignature(payload, header, "whsec_other", { now })).toBe(false);
    expect(verifyStripeSignature(payload, null, secret, { now })).toBe(false);
    expect(verifyStripeSignature(payload, "garbage", secret, { now })).toBe(false);
  });

  it("rejects replays outside the tolerance window", () => {
    const old = signStripePayload(payload, secret, timestamp - 301);
    expect(verifyStripeSignature(payload, old, secret, { now })).toBe(false);
    const recent = signStripePayload(payload, secret, timestamp - 299);
    expect(verifyStripeSignature(payload, recent, secret, { now })).toBe(true);
  });
});

import { describe, expect, it } from "vitest";

import { hasPremiumAccess, isSubscriptionStatus, statusGrantsPremium } from "@/lib/billing/entitlements";
import { stripeFormEncode } from "@/lib/billing/form-encode";
import { PLANS, isPlanId, yearlyMonthlyEquivalentCents, yearlySavingsPercent } from "@/lib/billing/plans";
import { signStripePayload, verifyStripeSignature } from "@/lib/billing/stripe-signature";

describe("plans", () => {
  it("prices Premium at $2.99/month and $29.99/year, in cents", () => {
    expect(PLANS.monthly.amountCents).toBe(299);
    expect(PLANS.yearly.amountCents).toBe(2999);
  });

  it("makes the yearly plan cheaper than twelve monthly payments", () => {
    expect(PLANS.yearly.amountCents).toBeLessThan(PLANS.monthly.amountCents * 12);
    expect(yearlySavingsPercent()).toBe(16);
    expect(yearlyMonthlyEquivalentCents()).toBe(250);
  });

  it("never reports a negative saving", () => {
    expect(
      yearlySavingsPercent({
        monthly: { ...PLANS.monthly, amountCents: 100 },
        yearly: { ...PLANS.yearly, amountCents: 5000 },
      })
    ).toBe(0);
  });

  it("only accepts known plan ids from forms", () => {
    expect(isPlanId("monthly")).toBe(true);
    expect(isPlanId("yearly")).toBe(true);
    expect(isPlanId("lifetime")).toBe(false);
    expect(isPlanId(null)).toBe(false);
  });
});

describe("entitlements", () => {
  it("grants Premium for active, trialing and past-due subscriptions only", () => {
    expect(statusGrantsPremium("active")).toBe(true);
    expect(statusGrantsPremium("trialing")).toBe(true);
    expect(statusGrantsPremium("past_due")).toBe(true);
    for (const status of ["none", "canceled", "unpaid", "incomplete", "incomplete_expired", "paused"] as const) {
      expect(statusGrantsPremium(status)).toBe(false);
    }
    expect(statusGrantsPremium(null)).toBe(false);
  });

  it("keeps every feature open until billing is switched on", () => {
    expect(hasPremiumAccess(false, "none")).toBe(true);
    expect(hasPremiumAccess(true, "none")).toBe(false);
    expect(hasPremiumAccess(true, "active")).toBe(true);
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

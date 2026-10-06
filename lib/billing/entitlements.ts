import type { PaidTier, Tier } from "./plans";

/**
 * Who gets Premium, as pure rules. A subscription counts while Stripe says
 * it's active or trialing; `past_due` keeps access through Stripe's retry
 * window (Stripe moves it to `canceled`/`unpaid` when retries run out), so
 * a declined renewal doesn't lock someone out mid-week.
 */

export type SubscriptionStatus =
  | "none"
  | "incomplete"
  | "incomplete_expired"
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "paused";

const PREMIUM_STATUSES: ReadonlySet<SubscriptionStatus> = new Set(["active", "trialing", "past_due"]);

export function isSubscriptionStatus(value: unknown): value is SubscriptionStatus {
  return (
    typeof value === "string" &&
    ["none", "incomplete", "incomplete_expired", "trialing", "active", "past_due", "canceled", "unpaid", "paused"].includes(
      value
    )
  );
}

export function statusGrantsPremium(status: SubscriptionStatus | null | undefined): boolean {
  return status != null && PREMIUM_STATUSES.has(status);
}

/**
 * The tier whose features a user can use right now. Gating only applies
 * once billing is switched on: before that (no Stripe keys) everything is
 * open -- the app must never lock people out of something they can't pay
 * for. A subscription that has lapsed, or whose price Verityio doesn't
 * recognise, counts as free.
 */
export function effectiveTier(
  billingEnabled: boolean,
  status: SubscriptionStatus | null | undefined,
  tier: PaidTier | null | undefined
): Tier {
  if (!billingEnabled) return "pro";
  return statusGrantsPremium(status) && tier ? tier : "free";
}

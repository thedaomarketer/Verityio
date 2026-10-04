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
 * Premium gating only applies once billing is switched on. Before that
 * (no Stripe keys), every feature stays open -- the app must never lock
 * people out of something they can't pay for.
 */
export function hasPremiumAccess(billingEnabled: boolean, status: SubscriptionStatus | null | undefined): boolean {
  return !billingEnabled || statusGrantsPremium(status);
}

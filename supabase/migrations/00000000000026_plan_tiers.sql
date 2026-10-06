-- Plus and Pro tiers (docs/pricing.md). The webhook records which tier a
-- subscription's Stripe price belongs to; the app grants features from it.
-- Still written only by the service-role client -- users keep select only.

alter table public.subscriptions
  add column plan_tier text check (plan_tier is null or plan_tier in ('plus', 'pro'));

-- Anyone already subscribed was on the single all-inclusive Premium plan.
update public.subscriptions set plan_tier = 'pro' where stripe_subscription_id is not null;

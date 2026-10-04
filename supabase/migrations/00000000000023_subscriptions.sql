-- Verityio Premium subscriptions (Stripe). One row per user, written only by
-- the server: the Stripe webhook (app/api/stripe/webhook) after verifying
-- Stripe's signature, and the checkout action recording the customer id.
--
-- Deliberately select-only for users: an insert/update policy would let
-- anyone grant themselves Premium from the browser. All writes go through
-- the service-role client, which bypasses RLS.

create table public.subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  stripe_customer_id text unique check (stripe_customer_id is null or char_length(stripe_customer_id) <= 255),
  stripe_subscription_id text unique check (stripe_subscription_id is null or char_length(stripe_subscription_id) <= 255),
  status text not null default 'none' check (
    status in ('none', 'incomplete', 'incomplete_expired', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused')
  ),
  plan_interval text check (plan_interval is null or plan_interval in ('month', 'year')),
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

create policy "subscriptions_select_own" on public.subscriptions
  for select using ((select auth.uid()) = user_id);

create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

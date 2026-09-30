-- Push notifications (OneSignal). A device's OneSignal subscription id is
-- linked to the WorkLedger account that turned notifications on from it; the
-- server sends to those ids directly (`include_subscription_ids`) rather than
-- to a client-asserted OneSignal "external id", which any browser could claim.

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  onesignal_id text not null unique check (char_length(onesignal_id) between 1 and 128),
  user_agent text check (user_agent is null or char_length(user_agent) <= 512),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index push_subscriptions_user_id_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

create policy "push_subscriptions_select_own" on public.push_subscriptions
  for select using ((select auth.uid()) = user_id);
create policy "push_subscriptions_insert_own" on public.push_subscriptions
  for insert with check ((select auth.uid()) = user_id);
create policy "push_subscriptions_update_own" on public.push_subscriptions
  for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "push_subscriptions_delete_own" on public.push_subscriptions
  for delete using ((select auth.uid()) = user_id);

-- A browser keeps its OneSignal subscription id across sign-ins, so when a
-- different account turns notifications on from the same device the id must
-- move to that account. RLS can't express "take over another user's row", so
-- this runs as definer -- but only ever for auth.uid().
create or replace function public.claim_push_subscription(p_onesignal_id text, p_user_agent text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'not authenticated';
  end if;

  insert into public.push_subscriptions (user_id, onesignal_id, user_agent)
  values ((select auth.uid()), p_onesignal_id, left(p_user_agent, 512))
  on conflict (onesignal_id) do update
    set user_id = excluded.user_id,
        user_agent = excluded.user_agent,
        last_seen_at = now();
end;
$$;

revoke execute on function public.claim_push_subscription(text, text) from public, anon;
grant execute on function public.claim_push_subscription(text, text) to authenticated;

-- One row per notification actually sent, so the every-15-minutes job never
-- repeats a reminder. Written only by the server (service role); users can
-- read their own history.
create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('long_shift', 'long_break', 'payday', 'test')),
  dedupe_key text not null check (char_length(dedupe_key) <= 200),
  sent_at timestamptz not null default now(),
  unique (user_id, dedupe_key)
);

alter table public.notification_deliveries enable row level security;

create policy "notification_deliveries_select_own" on public.notification_deliveries
  for select using ((select auth.uid()) = user_id);

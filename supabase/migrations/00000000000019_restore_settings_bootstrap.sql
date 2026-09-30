-- Migration 18 rewrote handle_new_user() to seed the time zone and language,
-- but dropped the user_settings insert that migration 12 had added -- so
-- every account created after it had no settings row, and the Settings and
-- Pay & Taxes pages rendered blank for them. Restore the insert, and backfill
-- the accounts that were created in between.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  requested_tz text := new.raw_user_meta_data ->> 'timezone';
  requested_locale text := new.raw_user_meta_data ->> 'locale';
begin
  -- Signup metadata is client-controlled, so both values are validated here
  -- rather than trusted, falling back to the column defaults.
  insert into public.profiles (id, email, full_name, timezone, locale)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    case when requested_tz is not null and public.is_valid_time_zone(requested_tz) then requested_tz else 'UTC' end,
    case when requested_locale in ('en', 'fr', 'es') then requested_locale else 'en' end
  )
  on conflict (id) do nothing;

  insert into public.user_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

-- Only ever runs as the auth.users trigger, never as an RPC (see migration 15).
revoke execute on function public.handle_new_user() from public, anon, authenticated;

insert into public.user_settings (user_id)
select p.id
from public.profiles p
where not exists (select 1 from public.user_settings s where s.user_id = p.id)
on conflict (user_id) do nothing;

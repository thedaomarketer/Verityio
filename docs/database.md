# Database

PostgreSQL via Supabase. All migrations live in `supabase/migrations/`,
numbered sequentially, and were applied directly to the live project
(`Verityio`, ref `hdeshlblsdsplpyayanz`) via the Supabase MCP tools during
this build.

## Tables

| Table | Purpose | Ownership column |
|---|---|---|
| `profiles` | Public profile per `auth.users` row | `id` (= `auth.users.id`) |
| `jobs` | Employers/gigs a user tracks time against | `user_id` |
| `shifts` | Scheduled and/or worked periods | `user_id` |
| `breaks` | Paid/unpaid breaks within a shift | `user_id` |
| `journal_entries` | Work Evidence Timeline entries | `user_id` |
| `expenses` | Work-related spending | `user_id` |
| `mileage_entries` | Work-related trips | `user_id` |
| `schedule_entries` | Calendar items independent of shifts | `user_id` |
| `attachments` | Metadata for files in the private `attachments` bucket | `user_id` |
| `audit_logs` | Append-only change log | `user_id` |
| `user_settings` | Per-user preferences | `user_id` |
| `ai_conversations` / `ai_messages` | AI assistant chat history | `user_id` |
| `push_subscriptions` / `notification_deliveries` | Push devices and sent-reminder log | `user_id` |
| `subscriptions` | Verityio Premium (Stripe) state, one row per user | `user_id` |
| `bank_items` / `bank_accounts` / `bank_transactions` | Linked banks (Plaid) and their data | `user_id` |
| `bank_item_secrets` | Encrypted Plaid access token + sync cursor per bank | `user_id` |

Every table has `alter table ... enable row level security` plus four
policies (`select`/`insert`/`update`/`delete`) scoped to
`(select auth.uid()) = user_id` (or `= id` for `profiles`). `audit_logs`
only has a `select` policy — inserts happen exclusively through the
service-role client from server-side code, never from an authenticated
user's own session.

### Server-written tables

`subscriptions` (migration 23) and the `bank_*` tables (migration 24) are
written only by trusted server code with the service-role client: the
Stripe webhook after verifying Stripe's signature, and the bank actions /
scheduler with data straight from Plaid's API. Users get `select` policies
only -- an insert/update policy would let anyone grant themselves Premium
or fabricate bank transactions from the browser. `bank_item_secrets` has
RLS enabled and **no policies at all**, so no user (not even the owner) can
read an access token through the API; the tokens are also AES-256-GCM
encrypted with an app key that never touches the database. Money columns
are `numeric(14,2)`; Plaid amounts keep Plaid's sign (positive = money
out). Everything cascades from `auth.users`.

**Status:** migrations 23 and 24 are applied to the live project; the
advisors report only the intentional "no policy" note on
`bank_item_secrets`.

## Key constraints

- `shifts_one_active_per_user_idx`: a **partial unique index** on
  `shifts (user_id) where status = 'active'`. This is the real guarantee
  against duplicate clock-ins — the client-side check in
  `lib/actions/shifts.ts#clockInAction` is a courtesy for a better error
  message, not the source of truth.
- `breaks_one_open_per_shift_idx`: same pattern, one open break per shift.
- `shifts_actual_order_check` / `shifts_scheduled_order_check` /
  `breaks_order_check` / `schedule_entries_order_check`: end must be after
  start wherever both are set.
- `jobs_dates_check`: `end_date >= start_date` when both are set.

## Locale and time zone

- `profiles.locale` (`'en' | 'fr' | 'es'`, default `'en'`, check
  constraint) is the saved UI language.
- `profiles.timezone` is constrained by `profiles_timezone_valid`, which
  calls `public.is_valid_time_zone(tz)` -- a `stable`, `search_path = ''`
  function checking `pg_catalog.pg_timezone_names`. An invalid zone can't be
  stored even by a request that bypasses the app's Zod validation.

Both were added in migration `00000000000018_locale_and_signup_timezone.sql`.

## New-user bootstrap

`handle_new_user()` (a `security definer` trigger function on
`auth.users after insert`) creates a `profiles` row and a default
`user_settings` row for every new signup. Since migration 18 it also seeds
`timezone` and `locale` from the signup metadata the browser sends --
validated inside the function (unknown zone -> `UTC`, unknown language ->
`en`), because signup metadata is client-controlled.

Migration 18 accidentally dropped the `user_settings` insert, so accounts
created between migrations 18 and 19 had no settings row (Settings and
Pay & Taxes rendered blank for them). Migration 19 restores the insert and
backfills the missing rows. As a second line of defense, pages read settings
through `lib/data/settings.ts#getOrCreateUserSettings`, and the settings
actions `upsert` rather than `update` (an update on a missing row reports
success while saving nothing). `EXECUTE` on this function is
revoked from `anon`/`authenticated`/`public` — it must only ever run as the
trigger, never be callable directly as an RPC (this was flagged by the
Supabase security linter and fixed; see migration `00000000000015`).

## Push notifications

- `push_subscriptions`: one row per device (OneSignal subscription id,
  unique) linked to the account that turned notifications on from it. RLS
  scopes all four operations to the owner; linking itself goes through a
  server action with the admin client, because a shared device's id may
  need to move between accounts (migration 20; a SECURITY DEFINER RPC tried
  first was dropped in migration 21 after the security linter flagged it).
- `notification_deliveries`: one row per reminder sent, `unique (user_id,
  dedupe_key)`, written only by the server; users can read their own.
- Migration 22 enables `pg_cron` and `pg_net` and schedules
  `workledger-reminders` every 15 minutes. Its URL and secret come from
  Vault (`workledger_app_url`, `workledger_cron_secret`), created outside
  migrations so no secret is committed.

## Storage

A private `attachments` bucket (`public = false`). Objects are expected
under `${auth.uid()}/...`; storage policies restrict
select/insert/update/delete to the owning user via
`(storage.foldername(name))[1] = auth.uid()::text`. There's no upload UI
yet (see `docs/current-state.md`), but the bucket and policies are ready.

## Regenerating this from scratch

```
npx supabase link --project-ref <id>
npx supabase db push
```

Or apply each file in `supabase/migrations/` in order via the Supabase SQL
editor / MCP `apply_migration` tool.

## Verifying RLS and constraints

This was done directly against the live database via SQL (not through the
app, since the build sandbox couldn't reach the project's API — see
`docs/current-state.md`):

1. Inserted a fake `auth.users` row directly → confirmed `profiles` and
   `user_settings` rows were auto-created by the trigger.
2. Created a job and an active shift for that user → attempted a second
   `insert ... status = 'active'` for the same user → got
   `duplicate key value violates unique constraint "shifts_one_active_per_user_idx"`.
3. Added an unpaid break, clocked out → computed paid minutes matched
   `lib/calculations/duration.ts`'s logic exactly (gross minutes minus
   unpaid break minutes).
4. Created a second fake user, set `role = authenticated` and
   `request.jwt.claims` to that user's `sub` in a SQL session, and
   confirmed `select count(*) from jobs/shifts/breaks` returned `0` for
   the first user's data while their own profile was still visible — then
   repeated as the first user to confirm they could see their own 1 row in
   each table.
5. Ran `get_advisors` (security and performance) after every schema
   change; fixed the `function_search_path_mutable`,
   `anon/authenticated_security_definer_function_executable`,
   `auth_rls_initplan`, and `unindexed_foreign_keys` findings it raised.
   The only remaining findings are `unused_index` (expected — the database
   has no query history yet).

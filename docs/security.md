# Security

## Row Level Security

Every user-owned table enforces `(select auth.uid()) = user_id` (or `= id`
for `profiles`) on all four operations. This was verified directly against
the live database — see `docs/database.md`'s "Verifying RLS and
constraints" section for the exact test performed (a second simulated user
could not see the first user's jobs, shifts, or breaks, and vice versa).

Never bypass RLS from application code. The only place that does is
`lib/supabase/admin.ts`, gated behind the `server-only` package, used only
for:

- Writing `audit_logs` rows (`lib/audit/log.ts`) — a user is never allowed
  to insert into their own audit log directly, since that would let a
  compromised or malicious client fabricate a false trail.
- Account deletion (`lib/actions/settings.ts#deleteAccountAction`) — needs
  `auth.admin.deleteUser`, which requires the service-role key.

Audit logging failures are caught and logged server-side; they never block
the primary action from succeeding (see `lib/audit/log.ts`).

## Secrets

- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`: safe to
  expose to the browser (that's what "publishable" means for Supabase).
- `SUPABASE_SERVICE_ROLE_KEY`: server-only, never prefixed `NEXT_PUBLIC_`,
  never imported outside `lib/supabase/admin.ts`. If it's unset or blank,
  the `SUPABASE_SECRET_KEY` that the Vercel Supabase integration provisions
  is used instead (`lib/supabase/env.ts`) -- production had the former
  defined but empty, which silently broke audit logging and account
  deletion. `.gitignore` excludes all
  `.env*` files except `.env.example`, which contains no real values.

## Database function hardening

The Supabase security linter (`get_advisors`) flagged two issues after the
initial migrations, both fixed in `00000000000015_harden_functions.sql`:

- `set_updated_at()` had no pinned `search_path` — fixed with
  `set search_path = ''`.
- `handle_new_user()` (the new-user trigger, `security definer`) was
  callable directly by `anon`/`authenticated` via
  `/rest/v1/rpc/handle_new_user` — `EXECUTE` was revoked from `public`,
  `anon`, and `authenticated` so it can only ever run as the
  `auth.users` insert trigger.

Re-run `get_advisors` (security and performance) after any schema change.

## Redirect targets

Post-sign-in (`redirectTo`) and email-confirmation (`next`) redirect
targets come from URLs an attacker can craft, and were previously passed
straight to `redirect()` -- an open redirect. Both now go through
`lib/safe-redirect.ts#safeRedirectPath`, which only allows same-site,
root-relative paths (rejecting `//host`, `/\host`, absolute URLs, and
control characters). Covered by `tests/unit/safe-redirect.test.ts`.

## Locale and time zone input

Time zone and language are validated server-side with Zod on every write
(settings, the one-tap time zone prompt, signup), and again by database
constraints. Signup metadata is client-controlled (the anon key is
public), so `handle_new_user()` validates it itself and falls back to
`UTC`/`en` rather than trusting it -- this was tested with a malformed zone
against the live database.

## Push notifications and the scheduler

- A device only receives an account's reminders if that account linked it
  from a signed-in session (server action + `auth.getUser()`); OneSignal
  "external ids" are not used, since any browser can claim one without
  OneSignal's identity verification. Sign-out unlinks the current device.
- `/api/cron/notifications` is outside the auth proxy but requires
  `Authorization: Bearer $CRON_SECRET` (constant-time comparison). The
  secret lives in Vercel env and Supabase Vault only.
- `ONESIGNAL_REST_API_KEY` is server-only; the App ID is public by design.
- Notification text is deliberately minimal (job name, durations; no pay
  amounts), since it can appear on a lock screen.

## Attachments

The `attachments` Storage bucket is private (`public = false`). Files are
expected under `${auth.uid()}/...` and storage policies restrict access to
the owning user's folder. The app must never construct or expose a public
URL for a stored file — always issue a short-lived signed URL server-side
once the upload UI exists.

## Billing (Stripe)

- `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` are server-only and read
  only in `lib/billing/stripe.ts` (`server-only`). No Stripe SDK; plain
  `fetch` with a 10s timeout.
- Premium is granted **only** by the webhook. It verifies the
  `Stripe-Signature` header (HMAC-SHA256 over the raw body, constant-time
  compare, 5-minute replay window -- `lib/billing/stripe-signature.ts`,
  unit-tested with valid, tampered, wrong-secret and stale cases) before
  parsing anything, then re-reads the subscription from Stripe rather than
  trusting the event snapshot. Returning to the success URL grants nothing.
- The checkout form only says "monthly" or "yearly"; amounts come from the
  server's `PLANS`. `subscriptions` has no user write policies.
- Billing is off until both keys are set, and while it's off nothing is
  locked (`hasPremiumAccess`), so a misconfiguration can't strand users.
  Once on, an unreadable subscription row fails closed (free).
- Premium checks run server-side on every gated surface: the assistant API,
  the CSV export routes, the bank actions, and the pages themselves.

## Bank connections (Plaid)

- Read-only: the app requests the `transactions` product only and can't
  move money. Bank logins happen inside Plaid Link; Verityio never sees
  them. The one-time public token is exchanged server-to-server.
- Access tokens: AES-256-GCM with a random 12-byte IV per token and an auth
  tag (`lib/bank/token-crypto.ts`), keyed by `BANK_TOKEN_ENCRYPTION_KEY`
  (32 random bytes, env only), stored in `bank_item_secrets`, which has RLS
  enabled and no policies. Decrypted only in server code, never logged.
  Rotating the key makes stored tokens unreadable (banks must reconnect).
- Every bank action verifies the session, Premium and configuration;
  disconnect proves ownership by reading the item through RLS and is
  allowed even after Premium ends.
- Disconnecting, and account deletion, call Plaid `/item/remove` so access
  is revoked at the source, then delete the rows (cascade).

## Account deletion

Deleting the `auth.users` row cascades to every user-owned table via
`on delete cascade` foreign keys, removing profile, jobs, shifts, breaks,
journal entries, expenses, mileage, schedule entries, attachment metadata,
audit logs, settings, AI conversation history, subscription state and
linked-bank data in one operation. Before the delete, the action cancels
any live Stripe subscription immediately (so a deleted account is never
billed again) and revokes linked banks at Plaid; both are best effort and
never block the deletion. It does
not currently delete the underlying files in the Storage bucket — that's a
known gap (see `docs/current-state.md`) since there's no attachment upload
UI yet to have created any.

## What hasn't been verified

- No penetration-style testing of the Next.js server actions themselves
  (e.g. attempting to pass another user's ID through a form field) has
  been performed — RLS is the actual enforcement boundary, so this matters
  less, but every action also re-derives the user from
  `supabase.auth.getUser()` rather than trusting a client-supplied ID.
- The build sandbox used for this initial implementation could not reach
  the live Supabase project over the network, so the auth flow itself
  (signup email confirmation, login, session cookies) has not been
  exercised through a real browser session — only at the database layer.
  Do this before shipping to real users.

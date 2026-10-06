# Current State

Last updated: 2026-09-25 (iOS-style UI refresh, public landing page, centered quick-create button).

This document describes what actually exists in the codebase today, as
opposed to what the product spec eventually calls for. See `docs/roadmap.md`
for what's next.

## What works end to end

- **Auth**: email/password registration, login, logout, password reset
  request + update, email confirmation callback (`app/auth/confirm`). Session
  refresh runs on every request via `proxy.ts` (Next.js 16's replacement for
  `middleware.ts`).
- **Database**: full schema applied to a live Supabase project (17
  migrations in `supabase/migrations/`) — `profiles`, `jobs`, `shifts`,
  `breaks`, `journal_entries`, `expenses`, `mileage_entries`,
  `schedule_entries`, `attachments`, `audit_logs`, `user_settings`,
  `ai_conversations`, `ai_messages`, plus a private `attachments` storage
  bucket. RLS is enabled and verified on every table (see `docs/security.md`).
  `jobs` also carries an optional `pay_frequency`/`pay_anchor_date`, and
  `user_settings` an optional `tax_country`/`tax_region`/`tax_city`, for the
  Pay & Taxes feature.
- **Calculation engine** (`lib/calculations/`): shift duration, paid/unpaid
  break handling, overtime split, per-workweek/day/month bucketing in a
  user's timezone, integer-cents money math. 36 unit tests cover the edge
  cases the spec calls out by name (midnight-crossing shifts, long shifts,
  multiple/paid/unpaid breaks, missing clock-outs, DST spring-forward and
  fall-back, overlap detection, rounding).
- **Jobs**: create, edit, archive/restore, delete (blocked if referenced
  data exists), per-job weekly/monthly stats.
- **Time tracking**: clock in/out, start/end break, manual shift entry
  (validated against overlaps and shift/break ordering), shift history with
  edit/delete, one-active-shift-per-user enforced at the database level.
- **Dashboard**: greeting, active-shift card or clock-in prompt, today/week
  metrics, overtime, estimated earnings, recent activity feed, upcoming
  shifts.
- **Journal**: structured entries (task, incident, safety issue, etc.) with
  icons, optional job/shift linkage — the Work Evidence Timeline's data
  source. Rendered as a timeline on `/journal`; surfaced on the dashboard.
- **Expenses / Mileage**: full CRUD, monthly totals, category breakdown for
  expenses.
- **Reports**: date-range + totals (hours, overtime, earnings, expenses +
  mileage), per-job breakdown, CSV export for hours and expenses.
- **Settings**: profile fields, preferences (workweek start day, default
  break length, overtime threshold, notifications), full JSON data export,
  account deletion (cascades through every table via `on delete cascade`).
- **Calendar**: month view merging worked/active shifts and schedule
  entries.
- **Audit log**: every mutation from a server action writes an
  `audit_logs` row via the service-role client.
- **AI Assistant** (`/assistant`): a real chat UI backed by the Anthropic
  API (`claude-opus-5`), with 9 read-only tools (`lib/ai/tools.ts`) scoped
  to the signed-in user's own data -- hours, overtime, earnings, shifts,
  expenses, mileage, schedule, journal entries, and a combined report.
  Conversation history persists to `ai_conversations`/`ai_messages`. See
  `docs/ai.md` for the full design. Requires `ANTHROPIC_API_KEY` to be set;
  without it, the assistant shows an error instead of crashing.
- **Pay & Taxes** (`/taxes`): upcoming-payday projection per job
  (`lib/calculations/payday.ts`, DST-safe), a pay-stub-style **pay period
  statement** (hours + gross pay from recorded shifts, plus estimated
  deductions/net pay for the current period once a jurisdiction is set),
  and an annual income tax + payroll deduction breakdown
  (`lib/calculations/tax/`) for a user-selected country/province-or-state/city,
  seeded from the user's own recorded earnings and editable. Single-filer,
  standard-deduction, 2024-bracket estimate, clearly labeled as such
  throughout the UI. Also surfaced as a compact "next payday" card on the
  dashboard. See `docs/tax.md`.
- **Installable / offline-resilient app (PWA)**: `app/manifest.ts` +
  `public/sw.js` make Verityio installable to a phone's home screen
  (`components/pwa/install-prompt.tsx` prompts on supporting browsers) and
  keeps the static app shell available when the network drops, falling back
  to a friendly `/offline` page instead of a browser error. Dynamic/auth
  pages always go to the network first -- nothing work-record-related is
  ever served stale.
- **Loading and error states**: `app/(app)/loading.tsx` shows a skeleton
  while any authenticated page's data loads; `app/(app)/error.tsx` and
  `app/global-error.tsx` catch runtime errors with a recovery screen instead
  of a blank page or default Next.js error overlay.
- **Visual analytics** (`/reports`): hand-rolled, dependency-free charts
  built in plain HTML/CSS (no charting library) --
  `components/charts/time-series-bar-chart.tsx`
  (weekly hours, regular vs. overtime stacked, and weekly earnings) and
  `components/charts/category-bar-chart.tsx` (hours/earnings by job,
  expenses by category) -- built on `lib/calculations/timeseries.ts#summarizeByWeek`
  (DST-safe weekly bucketing, reusing the same duration/overtime math as
  every other report) and `lib/charts/scale.ts` (nice-numbers axis
  scaling). Colors follow the dataviz skill's validated, CVD-checked
  categorical palette (`--chart-1..8` in `app/globals.css`); job/category
  bars carry a direct value label and hover/focus tooltip, never gating a
  number behind hover alone. The existing "By job" table remains the exact
  numeric reference alongside the charts.
- **Landing page** (`/`): signed-out visitors get a marketing homepage
  (hero, feature overview, privacy section, sign-up/sign-in calls to
  action); signed-in users are redirected straight to `/dashboard`. Every
  feature it describes is one that actually exists -- no invented stats or
  testimonials. The phone mockup in the hero is a static illustration.
- **iOS-style design system**: grouped-gray background with white inset
  cards, Apple's accessible system blue/red/green (each >= 4.5:1 on white),
  SF Pro on Apple devices (Geist elsewhere), capsule buttons with press
  feedback, frosted-glass header/sidebar/tab bar (`glass` utility in
  `app/globals.css`), iOS switches and segmented tabs, and dialogs that
  present as swipe-style bottom sheets with a grabber on phones. Inputs use
  16px text on mobile so iOS Safari doesn't auto-zoom on focus;
  `viewport-fit=cover` + `env(safe-area-inset-*)` padding keep bars clear of
  the notch and home indicator.
- **Quick-create menu**: a floating "+" button in the center of the mobile
  tab bar (an equal-width five-column grid, so it sits exactly at the
  screen's center; Calendar moved to the More screen to keep two tabs per
  side) and a "Create" button at
  the top of the desktop sidebar (`components/app-shell/create-menu.tsx`)
  open a sheet of shortcuts -- log a shift, add an expense, add mileage, new
  journal entry, add a job -- that deep-link to the page owning that create
  dialog via a `?new=` param (`hooks/use-auto-open.ts`), so the dialog opens
  automatically without duplicating any form/validation logic.
- **Language & time zone**: the whole app (every page, dialog, toast,
  validation and server error, CSV header, and the AI assistant's replies)
  is available in **English, French, and Spanish**, with dates, numbers,
  and currency formatted for the language (`en-US` / `fr-CA` / `es-US`).
  **Settings → Language & region** holds the language, currency, and a
  searchable picker over every IANA time zone (with UTC offsets, the
  current time there, and a "use this device's time zone" button). Signup
  captures the device's zone and the current language; accounts still on
  the UTC default get a one-tap banner to switch to the device's zone.
  Signed-out pages (landing, sign-in, sign-up) have a language switcher; the
  language otherwise comes from the saved profile, then the browser's
  `Accept-Language`. Every wall-clock value a user types (manual shifts,
  journal times, report/calendar ranges, CSV filters, AI date ranges) is
  read in the user's saved zone on the server -- see "Time zones" in
  `docs/architecture.md`.

Verified directly against the live Supabase project (`WorkLedger`,
`hdeshlblsdsplpyayanz`) via SQL: the new-user trigger creates a profile and
default settings row, the one-active-shift constraint rejects a duplicate
clock-in, and RLS correctly hides one user's jobs/shifts/breaks from another
user while still exposing their own. `npm run lint`, `npm run typecheck`,
`npm test` (158/158), and `npm run build` all pass. The charts and quick-create
menu were also verified visually (desktop + mobile viewports, hover/focus
tooltips) -- and the French/Spanish UI, time zone picker, and time zone
prompt at phone width -- via a temporary unauthenticated preview route +
Playwright screenshots, since this sandbox can't reach the live Supabase project to
exercise the authenticated app directly.

- **Public holidays** (Nager.Date, free, no key): the user's province/state
  (from Pay & Taxes) decides which holidays apply. They appear on the
  Calendar, as a "Holiday" badge on shifts worked that day, in the
  dashboard's Upcoming card (next 30 days), and as a note on paydays that
  land on one. Lists are cached for a week; if the API is slow or down the
  app simply shows no holidays.
- **Push notifications** (OneSignal): Settings → Push notifications turns
  them on per device. Every 15 minutes a Supabase pg_cron job calls
  `/api/cron/notifications`, which sends, at most once each: "still clocked
  in?" after 12h, "still on break?" after 1h, and "payday today" (after 8am
  local, mentioning a public holiday if payday falls on one). Text is in the
  user's language; the Preferences "Notifications" switch turns reminders
  off. **Dormant until** `NEXT_PUBLIC_ONESIGNAL_APP_ID` and
  `ONESIGNAL_REST_API_KEY` are set in Vercel -- the card says so until then.

- **Interactive homepage**: the hero phone is a live demo (ticking timer;
  Start break / Clock out / Clock in work and update the week's totals), and
  a pay estimator (rate, hours, overtime threshold and multiplier) runs the
  real `calculateEarnings` in integer cents. Sections fade in on scroll,
  except with reduced motion.
- **Dashboard interactions**: metric tiles link to the page behind the
  number, and a "Week so far" bar shows progress toward the default overtime
  threshold (overflow in the overtime colour).
- **Resources** (`/resources`, under More): official, free links for taxes,
  pay and rights, benefits and safety, for Canada or the US (defaulting to
  the Pay & Taxes country), plus a "Tax time" panel pointing at the user's
  own CSV exports, tax estimate and full data export. Every link was checked
  live when added (`lib/resources.ts`).
- **Where links land**: signed-out visitors opening any app link land on the
  homepage (`/?next=...`), whose Sign in buttons return them to that page;
  the installed app starts at `/`. Email confirmation links of both formats
  are handled (`?token_hash=` and Supabase's default `?code=`); a code
  opened on another device reports "email confirmed, sign in" instead of an
  error.

- **Verityio Premium** (`/premium`, Stripe): $2.99/month or $29.99/year
  (16% off; prices in `lib/billing/plans.ts`, integer cents). Checkout and
  the billing portal are Stripe-hosted; Premium is granted only by the
  signed webhook (`app/api/stripe/webhook`), which re-reads the
  subscription from Stripe and writes `subscriptions` with the service-role
  client. The product and prices are created on the first checkout by
  lookup key, so setup is just the keys. Premium covers bank connections,
  budget insights, the AI assistant, and advanced reports (pie/line charts,
  longer and custom ranges, PDF/CSV export). **Until Stripe is configured,
  gating is off and every feature is open** (`hasPremiumAccess`); everything
  else -- tracking, pay/tax estimates, expenses, mileage, journal, the full
  data export -- is always free.
- **Budget** (`/budget`, Premium): spending this month vs. last month at the
  same point, by category (pie) and over time (line), measured against the
  user's own earnings and hours: what they kept, how many hours of work
  their spending equals, the biggest and fastest-changing categories, the
  month-end pace, and a 50/30/20 suggested budget from estimated earnings.
  All derived in `lib/calculations/budget.ts` (pure, integer cents). Uses
  linked bank transactions when there are any, otherwise recorded expenses.
- **Bank connections** (Plaid Link, Premium): read-only; US and Canadian
  banks. Access tokens are AES-256-GCM encrypted with
  `BANK_TOKEN_ENCRYPTION_KEY` and stored in a table no user can read.
  Transactions sync on connect, on "Refresh", and every six hours via the
  existing 15-minute scheduler. Disconnecting (or deleting the account)
  revokes the item at Plaid.
- **Reports**: range presets (this week/month, last month; last 3 months,
  this year and custom ranges with Premium), six summary tiles (adds average
  per hour), an earnings-by-week line chart, pie charts for hours by job and
  expenses by category (bar charts on the free plan), Save as PDF (print
  stylesheet) and CSV exports for Premium.
- **Look and feel**: a dark "hero" card leads the dashboard (this week's
  estimated earnings, hours, overtime, today), glossy app icon, softer
  layered card shadows, a faint blue page wash. The AI assistant is a
  gradient sparkle icon in the header instead of a nav item. The **+**
  button opens a swipeable carousel of the four everyday actions (log a
  shift, expense, mileage, journal note); "Add a job" lives on Jobs.
- **Overtime is per workweek everywhere**: pay periods, the tax income
  estimate, month totals, Reports ranges and Budget earnings now use
  `summarizeRangeByJob` (`lib/calculations/range-summary.ts`): shifts are
  grouped into workweeks, each job's minutes accumulate chronologically,
  and only minutes past that week's threshold are overtime -- earlier days
  of a week that starts before the range still count. Previously a weekly
  threshold was applied to the whole range (a normal 80-hour fortnight
  showed 40 hours of overtime). The pay-period card also shows the last
  day worked (the period's end is payday, exclusive) and the payday, and on
  payday itself "current" means the period now being worked.
- **Reports drill-down**: every tile opens `/reports/<metric>` (hours,
  overtime, earnings, rate, expenses, mileage) for the same range, with a
  Daily / Weekly / Monthly / Yearly switch, a chart, per-period table, per-job
  totals and the individual shifts, expenses or trips. The main page's
  earnings chart has the same switch. Both share `lib/data/reports.ts`.
- **Calendar**: an iOS-style month grid (job-colored dots, today in red, the
  selected day's shifts below, a Today button) with Compact / Details
  (bars + hours per day) / List views; now includes planned (scheduled)
  shifts.
- **Downloads in the installed app**: exports are fetched in the background
  (`components/download-button.tsx`) and handed to the share sheet ("Save
  to Files") in the home-screen app, or saved via a temporary link in a
  browser. A plain link used to replace the app with the raw file and no
  way back.
- **Profile photo** (Settings) and **receipt photos** (each expense, and the
  Add expense form): images are downsized and re-encoded as JPEG in the
  browser (which strips location metadata), uploaded straight to the user's
  own folder in the private `attachments` bucket, then recorded by a server
  action that checks the exact path shape and that the file exists. Files
  are only ever served through short-lived signed URLs (`/api/avatar`,
  `/api/attachments/[id]`). Deleting an expense or the account removes its
  files. No new migrations were needed (the bucket, `attachments` table and
  `profiles.avatar_url` already existed).
- **Logo**: a "V" drawn as a checkmark with the dot of the "i" on a glossy
  blue squircle -- `public/brand/verityio-mark.svg` (plus square and
  maskable variants and a 1024px PNG), used for the favicon, the app icons
  and `components/brand-mark.tsx`.
- **Expenses list** is now a phone-friendly list (with receipt and delete
  buttons per row) instead of a six-column table.
- **Hide balances**: an eye button on the dashboard's week card, the
  Budget page and the bank accounts card masks money figures (week
  earnings, spent/earned/kept, bank balances, transaction amounts) as
  "••••••". Remembered per device in the `wl-hide-amounts` cookie
  (`lib/privacy.ts`), read by the app layout so pages render already
  masked. A screen-privacy convenience, not a security control.
- **Dashboard week totals** now include shifts from the start of a workweek
  that began in the previous month (previously only the current month's
  shifts were loaded, undercounting such weeks).

## What's stubbed or missing

- **Migrations 23 and 24 are applied** (October 6): `subscriptions` and the
  `bank_*` tables exist with RLS on. Verified as an authenticated user:
  inserting a Premium subscription or a bank transaction is rejected
  (42501), and `bank_item_secrets` / other users' subscriptions return no
  rows. Advisors: `bank_item_secrets` "RLS enabled, no policy" is
  intentional (service-role only); "leaked password protection disabled" is
  an Auth dashboard setting.
- **Attachments**: receipts on expenses only; journal entries and shifts
  don't take files yet. `expenses.receipt_url` holds the first receipt's
  path as a "has a receipt" marker for lists.
- **Job detail tabs**: the spec describes Overview/Time/Journal/Expenses/Reports/Settings
  tabs per job. The current `/jobs/[id]` page is a single overview (stats +
  this month's shifts + edit), not tabbed.
- **PDF export**: via the browser's print dialog ("Save as PDF") with a
  print stylesheet, not a generated PDF file.
- **Notifications**: `user_settings.notifications_enabled` exists as a
  preference, but no actual push/email notifications are sent (payday and
  shift reminders are shown in-app only -- see Pay & Taxes below).
- **E2E browser test**: Playwright is installed but no `tests/e2e/` suite
  exists yet, and the sandboxed build environment used for this initial
  build could not reach the live Supabase project's domain over the
  network (outbound egress is allowlisted per-environment), so the running
  app itself was never exercised in a real browser here. The full flow was
  instead verified at the database layer directly (see `docs/security.md`).
  Run `npm run dev` with `.env.local` filled in from a network that can
  reach `*.supabase.co` to do a real browser pass.
- **Teams/business features**: not started (Phase 9 in the original spec).
- **Premium in production**: needs a Verityio Stripe account's
  `STRIPE_SECRET_KEY` and a webhook endpoint's `STRIPE_WEBHOOK_SECRET` in
  Vercel. Prices are USD only.
- **AI Assistant**: non-streaming (shows a "Thinking..." indicator, not
  token-by-token output), no conversation switcher (only the most recent
  conversation is resumed), and no rate limiting on the chat endpoint yet.
- **AI Assistant in production**: needs `ANTHROPIC_API_KEY` in the Vercel
  project; until it's set, `/assistant` shows a "not switched on yet"
  notice instead of a chat that can only fail.
- **Bank connections in production**: need `PLAID_CLIENT_ID`,
  `PLAID_SECRET`, `PLAID_ENV` and `BANK_TOKEN_ENCRYPTION_KEY` in Vercel, and
  Plaid production access (an application reviewed by Plaid) before real
  banks work; the sandbox only has test banks. No Plaid webhooks yet (sync
  is on demand plus every six hours) and no "update mode" re-login: a bank
  that needs a new sign-in is disconnected and connected again.
- **Tax preparation**: Verityio estimates withholding and exports records,
  but doesn't file returns; the Resources page links to official free
  filing help.
- **Translations**: French and Spanish were written in-house, not by a
  professional translator; province/state/city names in tax lines stay in
  English. Supabase's own auth error messages (e.g. on signup) and emails
  are still English. The unused `profiles.date_format` column is no longer
  exposed -- dates follow the language's conventions instead.
- **Pay & Taxes**: tax bracket data (`lib/calculations/tax/`) is a
  hand-written, point-in-time snapshot for the 2024 tax year, not pulled
  from a live feed -- see the caveats in `docs/tax.md`. No push/email
  payday reminders yet -- payday surfaces on the dashboard and `/taxes`
  when the app is open, but isn't pushed to the user in the background.

## Live deployment

- Production: **https://verityio.vercel.app** (Vercel project
  `workledger`). Earlier addresses -- `verity-work.vercel.app`,
  `workledgerio.vercel.app` and `workledger-three.vercel.app` -- redirect
  pages there (308, same path) from `proxy.ts`; `/api/` requests are never
  redirected, because the reminder scheduler's pg_net calls don't follow
  redirects.
- The reminder scheduler's Vault URL (`workledger_app_url`) points at
  `https://verityio.vercel.app` (updated October 6; the old
  `verity-work.vercel.app` alias was removed from the project).
- `NEXT_PUBLIC_SITE_URL` is the production URL (used for email links and
  push notification links). Supabase Auth's **Site URL** and **Redirect
  URLs** must list the same address, or confirmation/reset emails link to
  the wrong place -- that's a Supabase dashboard setting
  (Authentication -> URL Configuration).
- The admin client uses `SUPABASE_SECRET_KEY` from the Vercel Supabase
  integration because `SUPABASE_SERVICE_ROLE_KEY` is blank there (see
  `docs/security.md`).
- `NEXT_PUBLIC_ONESIGNAL_APP_ID` is set (OneSignal app
  `023dc5b1-…`; the worker in `public/push/onesignal/` matches OneSignal's
  v16 download). `ANTHROPIC_API_KEY`, `ONESIGNAL_REST_API_KEY`, the Stripe keys and `BANK_TOKEN_ENCRYPTION_KEY`
  are **not** (the Plaid sandbox keys `PLAID_CLIENT_ID`/`PLAID_SECRET`/`PLAID_ENV`
  are set; bank connections stay off until the encryption key is added too)
  yet set: the AI Assistant, push notifications, Premium checkout and bank
  connections show "not switched on yet" until they are.

## Name

The product was renamed from WorkLedger to Verity, then to **Verityio** ("The true record of
your work."). The name lives in `lib/brand.ts` and the message
dictionaries. Internal identifiers keep the old name on purpose -- the
`wl-` cookies, `workledger:` localStorage keys, `workledger_*` Vault
secrets, the `workledger-reminders` cron job, the Vercel project, the
GitHub repository and the local folder -- because renaming them would reset
users' saved preferences or require infrastructure moves for no visible
benefit.

Credit and trademark notice: "Built by DAO · Verityio™ is a trademark of
Nexora Digital Systems." (`BUILT_BY` / `TRADEMARK_OWNER` in `lib/brand.ts`,
translated strings `common.builtBy` / `common.trademark`, rendered by
`components/brand-credit.tsx`). It appears in the landing-page footer, under
the sign-in/register forms, on the Help page and on the mobile More screen.

## Live Supabase project

- Project: `WorkLedger` (ref `hdeshlblsdsplpyayanz`, `us-east-1`), created
  under the same organization as the user's other projects, on the free
  tier.
- To free up a project slot, `gloworganicatelier@gmail.com's Project` was
  paused (with explicit user confirmation) — it can be resumed from the
  Supabase dashboard at any time.
- `.env.local` (gitignored) has the real project URL and anon key wired up.
  `SUPABASE_SERVICE_ROLE_KEY` is a placeholder — fill in the real value from
  the Supabase dashboard's API settings before using account deletion or
  relying on audit logging locally.

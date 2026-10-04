# Roadmap

Status as of this build. See `docs/current-state.md` for the detailed
"what works / what's stubbed" breakdown.

## Done

- **Phase 0 — Foundation**: Next.js 16 + TypeScript + Tailwind v4 +
  hand-built shadcn-style components, Supabase project provisioned, full
  schema + RLS applied and verified, CI-equivalent checks (lint, typecheck,
  test, build) all pass.
- **Phase 1 — Core Time Tracking**: jobs CRUD, clock in/out, breaks,
  manual shift entry, shift history, calculation engine with 36 unit
  tests.
- **Phase 2 — Dashboard**: today/week/month hours, overtime, estimated
  earnings, recent activity, upcoming shifts.
- **Phase 3 — Work Records** (partial): journal entries with types/icons,
  rendered as a timeline. Attachments table + private storage bucket exist
  but have no upload UI. No dedicated audit-history UI yet (the data is
  captured in `audit_logs`).
- **Phase 4 — Money**: overtime calculation, expenses, mileage, earnings
  baked into the dashboard and reports.
- **Phase 5 — Reports**: hours/earnings/overtime/expense reports with job
  and date-range filters, CSV export, plus visual analytics -- weekly
  hours/earnings trend charts and hours/earnings/expense breakdowns by
  job/category (`components/charts/`, dataviz-skill-validated palette). No
  PDF export.
- **Phase 6 — AI**: implemented. Chat assistant at `/assistant`, backed by
  Claude with 9 read-only tools scoped to the user's own data. See
  `docs/ai.md`.
- **Pay & Taxes**: implemented. `/taxes` shows upcoming paydays and a
  pay-stub-style pay period statement per job (`lib/calculations/payday.ts`)
  and an estimated income tax + payroll deduction breakdown
  (`lib/calculations/tax/`) for a user-selected country/province-or-state/city,
  also surfaced on the dashboard. See `docs/tax.md`.
- **Phase 7 — Mobile/PWA** (partial): installable app (manifest + service
  worker + install prompt), offline fallback for the static shell,
  skeleton loading states and error boundaries across the authenticated
  app, plus a floating quick-create action button (mobile bottom nav) and
  matching sidebar button (desktop) for the five most common create flows.
  No push notifications yet.
- **Deployed**: live on Vercel at https://verityio.vercel.app.

- **Premium**: Stripe subscriptions ($2.99/month, $29.99/year) gating bank
  connections, budget insights, the AI assistant and advanced reports --
  dormant until a Verityio Stripe account's keys are added.
- **Budget and bank connections**: Plaid-linked accounts, spending by
  category and over time, insights tied to hours worked, 50/30/20 plan.
- **Reports**: presets, pie and line charts, Save as PDF.

## Not started

- **Push notifications**: web push for payday/shift/break reminders --
  `user_settings.notifications_enabled` exists as the preference toggle,
  but nothing sends a push yet (would need a `push_subscriptions` table +
  VAPID keys + a scheduled sender, e.g. a Supabase Edge Function on
  `pg_cron`).
- **Phase 9 — Business/Teams**: not started.

## Immediate next steps, in priority order

Following the original spec's priority order (never trade data integrity
for polish):

1. **P0** — Run a real browser E2E pass against the live Supabase project
   from a network that can reach it (the build sandbox couldn't). Fill in
   the real `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` first so account
   deletion and audit logging work locally too.
2. **P0** — Add a `tests/e2e/` Playwright suite covering the critical flow
   (register → job → clock in/break/out → dashboard → report → export →
   logout/login).
3. **P1** — Job detail tabs (Overview/Time/Journal/Expenses/Reports) to
   match the spec's per-job navigation, rather than the current single
   overview page.
4. **P1** — Attachment upload UI (receipts on expenses, files on journal
   entries), wired to the existing private bucket + signed URLs.
5. **P0** — Apply migrations 23 (subscriptions) and 24 (bank connections)
   to the live database and run the advisors.
6. **P1** — Switch on Premium (Stripe keys + webhook) and bank connections
   (Plaid keys, encryption key, Plaid production approval).
7. **P2** — Plaid webhooks and update-mode re-login; a yearly tax summary.
7. **P3** — Push notifications (shift/clock-in/clock-out/break reminders,
   weekly summary, payday reminders) — `user_settings.notifications_enabled`
   already exists as the preference toggle; the app is now installable, so
   this is the natural next mobile-parity step.
8. **P3** — Make the clock-in flow itself resilient to a mid-punch network
   drop (queue the punch locally and sync when back online) -- today the
   offline fallback covers navigation/shell, not an in-flight clock-in
   submission.
9. **P4** — Team/business features.

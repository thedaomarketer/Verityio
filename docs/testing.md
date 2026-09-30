# Testing

## Unit tests (Vitest)

`tests/unit/calculations/` — 36 tests covering every edge case the product
spec calls out by name:

- `duration.test.ts`: midnight-crossing shift, long (15h) shift, multiple
  unpaid breaks summing correctly, paid breaks not reducing paid time,
  unpaid breaks reducing paid time, missing clock-out (incomplete shift),
  a break still open at clock-out getting clamped to the shift end,
  **DST spring-forward** (1 real hour reported correctly, not 2 nominal
  hours), **DST fall-back** (2 real hours reported correctly, not 1),
  shift overlap detection, shift/break time validation.
- `overtime.test.ts`: regular/overtime split at a threshold, overtime
  disabled, a full "$24/hr, OT after 44h/week" scenario, explicit vs.
  fallback overtime rate, float-drift resistance over 100 fractional-hour
  shifts.
- `money.test.ts`: dollar/cent round-tripping, partial-hour earnings,
  cent rounding, currency formatting.
- `workweek.test.ts`: Monday-start and Sunday-start workweek bounds, a
  workweek that spans a DST transition (169 hours instead of 168), shift
  grouping.
- `period.test.ts`: local day and month bounds in a given timezone.
- `summary.test.ts`: aggregating multiple shifts per job with overtime
  applied once to the total, excluding incomplete shifts, keeping separate
  jobs independent.
- `payday.test.ts`: next-payday projection for weekly/biweekly/monthly/
  semi-monthly schedules, a DST-crossing weekly payday, a monthly anchor on
  the 29th-31st clamping to a shorter month without permanently drifting
  off the anchor day, and `getPayPeriod`'s start/end boundaries (including
  the clamped-month-end case and the "anchor hasn't happened yet" empty
  period).
- `timeseries.test.ts`: `summarizeByWeek` includes an all-zero week rather
  than skipping a week with no shifts, computes correct weekly earnings,
  and produces consecutive non-overlapping weeks across a DST transition.

`tests/unit/calculations/tax/` — bracket math (marginal tax, capped flat
deductions) and the full `estimateTax`/`estimateTaxForPeriod` pipeline for
both countries, including the zero-income and unknown-jurisdiction cases.

`tests/unit/charts/scale.test.ts` — the "nice numbers" axis-scaling helper
behind the Reports charts, including a regression case for a bug where a
fixed tick count could stop short of the computed axis max and let a bar
visually overshoot the topmost gridline.

`tests/unit/ai/period.test.ts` — the AI assistant's natural-language period
resolver ("today", "last week", etc.) against the same day/week/month
bounds helpers used everywhere else, plus custom ranges anchored to local
midnight in a UTC+14 zone and across a 23-hour DST day.

`tests/unit/calculations/local-time.test.ts` — wall-clock → instant
conversion in the user's zone: a Toronto 09:00 start, an overnight shift
rolling to the next calendar day, an overnight shift across spring-forward
(7 real hours), explicit end dates, and malformed input.

`tests/unit/timezone.test.ts` — zone validation, UTC offsets (including
DST), modern names for retired ICU aliases, `Accept-Language` matching,
and placeholder filling.

`tests/unit/i18n.test.ts` — French and Spanish have exactly the English
entries, the same `{placeholders}` in every string, no empty strings, and
are actually translated; validation keys translate per language.

`tests/unit/format.test.ts` — locale-aware hour/minute formatting, calendar
dates that never shift through a zone, instants rendered in the user's
zone and language, and payday countdown labels.

`tests/unit/safe-redirect.test.ts` — the open-redirect guard.

`tests/unit/supabase-env.test.ts` — the admin key falls back to
`SUPABASE_SECRET_KEY` when `SUPABASE_SERVICE_ROLE_KEY` is blank.

Run: `npm test` (or `npm run test:watch`).

## Database-level verification

Because the build sandbox couldn't reach the live Supabase project's API
over the network, the golden path and RLS were verified with direct SQL
against the live database instead of through the running app. See
`docs/database.md`'s "Verifying RLS and constraints" section for exactly
what was run and what it proved (new-user trigger, duplicate-clock-in
rejection, paid-minutes math matching the calculation engine, cross-user
isolation).

**This is not a substitute for real browser testing.** Before shipping,
run `npm run dev` from a network that can reach `*.supabase.co`, fill in
`.env.local` with real Supabase project credentials, and walk the full
flow: register → confirm email → create job → clock in → break → clock out
→ view dashboard/reports → journal entry → expense → mileage → export data
→ log out → log back in → confirm data persisted → confirm a second
account can't see it.

## Static checks

```
npm run lint       # ESLint (flat config, Next.js 16's plugin defaults)
npm run typecheck   # tsc --noEmit, strict mode
npm run build       # next build — also runs TypeScript checking
```

All three currently pass cleanly.

## What's missing

- No integration tests against a real (or local) Supabase instance from
  the app layer — only the unit-tested calculation engine and the direct
  SQL verification above.
- No `tests/e2e/` Playwright suite yet, though Playwright is installed
  (`npm run test:e2e` is wired up in `package.json` once specs exist).
- No accessibility audit tooling wired into CI.

## Adding tests for new work

- Pure logic (anything that could live in `lib/calculations/`) gets a
  Vitest unit test — no mocking required, since the module has no
  dependency on Next.js, React, or Supabase.
- Server actions (`lib/actions/`) are harder to unit test in isolation
  since they call `createClient()` from `lib/supabase/server.ts`, which
  needs a request context. Prefer extracting any non-trivial logic into
  `lib/calculations/` or `lib/validation/` and unit-testing that; cover the
  action itself via an E2E test once the suite exists.

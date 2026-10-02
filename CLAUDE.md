# CLAUDE.md

## Project

You are building Verity.

Verity is a worker-focused work recording and productivity platform.

Its core purpose is to help users accurately record:

- Work hours
- Breaks
- Jobs
- Schedules
- Tasks
- Work notes
- Incidents
- Expenses
- Mileage
- Earnings

The application must be trustworthy, fast, secure, accessible, and mobile-friendly.

---

## Primary Objective

Build production-quality software.

Do not optimize for merely making the application appear complete.

Every feature must work end to end.

A button that visually works but does not persist data is incomplete.

A calculation that looks correct but fails edge cases is incomplete.

A feature without tests is incomplete.

---

## Technology

Use:

- Next.js (App Router)
- React
- TypeScript
- Tailwind CSS
- shadcn/ui-style components (see `components/ui/`)
- Supabase (PostgreSQL, Auth, Storage)
- Zod
- Vitest
- Playwright

Use the existing project configuration when one exists.

Do not replace the stack without a strong technical reason.

Next.js 16 renamed `middleware.ts` to `proxy.ts` and removed synchronous
`params`/`searchParams`/`cookies()`/`headers()` access. Before writing App
Router code, check `node_modules/next/dist/docs/` (via `AGENTS.md`) for
breaking changes against your training data.

---

## Engineering Rules

1. TypeScript strict mode.
2. Avoid `any`.
3. Validate external input (Zod schemas in `lib/validation/`).
4. Validate server-side, not just client-side.
5. Never trust client calculations — derive durations/earnings server-side
   from `lib/calculations/`.
6. Never expose secrets.
7. Never expose the Supabase service-role key to the browser (`lib/supabase/admin.ts`
   imports `server-only` for exactly this reason).
8. Use RLS for all user-owned data.
9. Use parameterized queries (the Supabase client already does this).
10. Keep business logic (`lib/calculations`, `lib/actions`) separate from UI.
11. Keep calculations deterministic.
12. Use exact integer-cents arithmetic for money — never raw floats
    (`lib/calculations/money.ts`).
13. Store timestamps with time zone information (`timestamptz`).
14. Test date/time edge cases (midnight shifts, DST, missing clock-outs).
15. Make mobile behavior intentional — see Mobile Rules below.

---

## Database Rules

Every user-owned table must contain a user ownership column (`user_id`, or
`id` for `profiles`).

Every user-owned table must have RLS enabled with `select`/`insert`/`update`/`delete`
policies scoped to `(select auth.uid()) = user_id`. Wrap `auth.uid()` in
`(select ...)` so Postgres evaluates it once per query, not once per row.

Never rely solely on frontend filtering for authorization.

Test unauthorized (cross-user) access explicitly — see `docs/security.md`
for how this was verified against the live database.

New migrations go in `supabase/migrations/`, numbered sequentially. Run
`mcp__Supabase__get_advisors` (security and performance) after any schema
change and fix what it flags.

---

## Time Rules

Never calculate working time using naive date strings.

All calculations in `lib/calculations/` operate on absolute instants (`Date`
or ISO-8601 strings with an offset) so diffs are correct across DST and time
zone changes by construction — never parse a "local" wall-clock string and
diff it directly.

Use a dedicated calculation layer (`lib/calculations/`) for everything
duration-related. Represent durations internally as integer minutes.

Handle:

- Midnight-crossing shifts
- DST transitions (spring-forward and fall-back)
- Multiple breaks per shift, paid and unpaid
- Missing clock-outs (shift stays `active`/incomplete, never silently closed)
- Overlapping shifts (`shiftsOverlap`, enforced both client- and server-side)
- Manual edits (write an `audit_logs` row)

---

## Money Rules

Never use floating-point arithmetic for financial calculations. All money
math happens in integer cents (`lib/calculations/money.ts`); the only place
a fractional dollar amount is tolerated is converting a user-entered value
to cents, which is rounded immediately.

Use PostgreSQL `numeric` types, never `float`/`double precision`, for any
column holding money.

Separate recorded, estimated, and calculated values in the UI copy. Never
present an estimate as an actual payroll result — see `docs/ai.md` for the
required phrasing once the AI assistant ships.

---

## UI Rules

The application must feel polished.

Prioritize, in order:

1. Clarity
2. Speed
3. Accuracy
4. Accessibility
5. Visual consistency

Do not overdesign. Do not create unnecessary animations. Do not hide
important actions.

The clock-in action must always remain one tap/click away from the
dashboard and the Time page.

---

## Mobile Rules

Design mobile first.

Primary actions must be thumb-friendly (44px+ touch targets).

Avoid dense desktop tables as the primary mobile interface — use the
existing card/list patterns (see `components/time/shift-history-table.tsx`
for the table variant used inside cards, and the mobile bottom nav in
`components/app-shell/mobile-nav.tsx`).

---

## AI Rules

AI is an assistant, not the source of truth. Database records are the
source of truth.

When the AI assistant is built (see `docs/ai.md`), it must use controlled
server-side tools — never arbitrary SQL, never direct table access from the
model.

The AI must never fabricate hours, earnings, shifts, expenses, incidents,
or dates. When data is missing, it must say so.

---

## Security Rules

Treat work records as potentially sensitive: authentication, personal data,
employment records, attachments, AI conversations, and financial
information.

Never place secrets in source code. Never commit `.env*` files (see
`.gitignore`; `.env.example` is the only tracked exception). Never log
passwords or tokens.

Account deletion (`lib/actions/settings.ts#deleteAccountAction`) uses the
admin client to remove the `auth.users` row, which cascades to every
user-owned table via `on delete cascade`. Keep it that way — don't add a
soft-delete path that leaves orphaned data.

---

## File Rules

Do not create unnecessary files.

Before creating a new abstraction, inspect the existing project structure
(`lib/calculations`, `lib/actions`, `lib/data`, `lib/validation`,
`components/ui`, `components/<domain>`) and follow its conventions.

Reuse components when appropriate. Avoid duplicate implementations.

---

## Documentation Rules

Keep documentation updated when architecture changes.

- Product scope: `docs/product.md`
- Architecture decisions: `docs/architecture.md`
- Database schema/RLS: `docs/database.md`
- Security posture: `docs/security.md`
- AI assistant design: `docs/ai.md`
- Testing strategy: `docs/testing.md`
- Roadmap and phase status: `docs/roadmap.md`
- What's actually built vs. planned: `docs/current-state.md`

---

## Testing Rules

Every major feature requires unit tests at minimum; critical flows need
integration/E2E coverage.

The calculation engine (`lib/calculations/`) is the highest-value test
target — it has 36+ unit tests in `tests/unit/calculations/` covering
midnight shifts, DST transitions, multiple/paid/unpaid breaks, missing
clock-outs, overlap detection, and money rounding. Any change to
`lib/calculations/` must keep these passing and add cases for new behavior.

Critical flow (must stay working after every major change):

```
Register → Create job → Clock in → Start break → End break → Clock out
  → View hours → View earnings → Generate report
```

Run before considering any change done:

```
npm run lint
npm run typecheck
npm test
npm run build
```

---

## Development Workflow

For every task:

1. Inspect the existing repository.
2. Understand the architecture (`docs/architecture.md`, `docs/current-state.md`).
3. Identify affected files.
4. Implement the smallest coherent change.
5. Run lint, typecheck, unit tests, and build.
6. Fix failures.
7. Review the implementation.
8. Update documentation.
9. Verify the UI (start `npm run dev`, check the affected pages) whenever
   the change touches anything user-facing.
10. Continue to the next task.

Do not stop after writing code without verifying it.

---

## Definition of Done

A feature is done only when:

- UI exists (with loading, empty, and error states).
- Backend exists where required (`lib/actions/`).
- Database integration works, including RLS.
- Validation works (Zod schema + server-side check).
- Mobile layout works.
- Accessibility is considered (labels, focus states, semantic HTML).
- `npm run lint`, `npm run typecheck`, and `npm test` all pass.
- Documentation is updated.

---

## Product Philosophy

Build for real workers.

The user should be able to open the application and quickly understand:

- Am I working?
- How long have I worked?
- How much have I earned?
- What happened during my shift?
- What is coming next?

Avoid unnecessary complexity.

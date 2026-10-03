# Verityio

Your complete record of work.

Verityio is a worker-focused time tracking and work management app:
clock in/out, breaks, jobs and overtime rates, a work journal (Work
Evidence Timeline), expenses, mileage, a dashboard, and reports — for
employees, contractors, freelancers, and gig workers.

## Stack

Next.js (App Router) · TypeScript · Tailwind CSS v4 · Supabase (Postgres,
Auth, Storage, RLS) · Zod · Vitest

See `CLAUDE.md` for engineering rules and `docs/` for architecture,
database, security, testing, AI design, and roadmap details.

## Getting started

1. Install dependencies:

   ```
   npm install
   ```

2. Create a Supabase project, then apply every migration in
   `supabase/migrations/` in order (via the Supabase CLI's
   `supabase db push`, the SQL editor, or the Supabase MCP tools).

3. Copy `.env.example` to `.env.local` and fill in your project's URL and
   keys (Supabase dashboard → Settings → API):

   ```
   cp .env.example .env.local
   ```

4. Run the dev server:

   ```
   npm run dev
   ```

## Scripts

```
npm run dev         # start the dev server
npm run build        # production build
npm run lint          # ESLint
npm run typecheck     # tsc --noEmit
npm test               # Vitest unit tests
npm run test:e2e        # Playwright (once a suite exists)
```

## Project status

See `docs/current-state.md` for exactly what's implemented today versus
planned (`docs/roadmap.md`).

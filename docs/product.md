# Product

Verityio is a worker-focused work management application: a complete,
trustworthy record of when someone worked, what they did, what they should
have earned, and what happened during their shift.

It targets employees, contractors, freelancers, gig workers, tradespeople,
and anyone working multiple jobs — not just salaried office workers.

## The five questions

Every screen should help answer one of these:

1. When did I work?
2. What did I do?
3. How much should I have earned?
4. What happened during my work?
5. Can I prove or explain my work history later?

AI (see `docs/ai.md`) enhances the product but is never required for core
functionality — a user who never touches the AI assistant still gets a
complete, working product.

## MVP scope (built)

- Auth (email/password, password reset, email confirmation)
- Jobs (multiple jobs, hourly + overtime rate, active/archived)
- Time tracking (clock in/out, breaks, manual entry, shift history)
- Dashboard (today/week hours, overtime, estimated earnings, recent
  activity, upcoming shifts)
- Journal / Work Evidence Timeline (structured notes, tasks, incidents)
- Expenses and mileage tracking
- Reports (hours, overtime, earnings, expenses, CSV export)
- Calendar (month view of worked + scheduled time)
- Settings (profile, preferences, data export, account deletion)

## Premium ($2.99/month or $29.99/year)

- Bank connections (Plaid, read-only) and the Budget page: spending by
  category and over time, measured against hours worked, with insights and
  a suggested 50/30/20 budget
- AI assistant
- Advanced reports: pie and line charts, longer and custom ranges, PDF and
  CSV exports

Always free: time tracking, breaks, jobs, pay and tax estimates, expenses,
mileage, the journal, and a full export of your data. Every estimate is
labeled as one; nothing is presented as a payroll result or financial
advice.

## Deferred to later phases

- AI Assistant (natural-language queries over your own data)
- File attachments / receipts UI
- PDF export
- Notifications
- Offline support / PWA
- Monetization (subscriptions)
- Team/employer features

See `docs/roadmap.md` for the phase breakdown and `docs/current-state.md`
for exactly what's implemented today.

## Information architecture

Mobile bottom nav: Dashboard, Time, **+** (create carousel), Reports, More.

Desktop sidebar: Dashboard, Time, Calendar, Jobs, Journal, Expenses,
Mileage, Budget, Reports, Pay & Taxes, Resources — then Premium, Settings,
Help. The AI assistant is the sparkle icon in the header on every screen.

See `components/app-shell/nav-items.ts` for the single source of truth
both navs read from.

## Design principles

- Clean, modern, high information density — not a generic enterprise HR
  tool.
- The clock-in action is always one tap away.
- Mobile is a first-class platform: cards and stacked records, not dense
  desktop tables, as the primary mobile UI.
- Never show a fake/placeholder statistic once real data exists.

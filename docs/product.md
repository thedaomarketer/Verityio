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

Mobile bottom nav: Home (Dashboard), Time, Calendar, Reports, More.

Desktop sidebar: Dashboard, Time, Calendar, Jobs, Journal, Expenses,
Mileage, Reports, AI Assistant — then Settings, Help.

See `components/app-shell/nav-items.ts` for the single source of truth
both navs read from.

## Design principles

- Clean, modern, high information density — not a generic enterprise HR
  tool.
- The clock-in action is always one tap away.
- Mobile is a first-class platform: cards and stacked records, not dense
  desktop tables, as the primary mobile UI.
- Never show a fake/placeholder statistic once real data exists.

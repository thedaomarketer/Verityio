# AI Assistant

**Status: implemented.** `/assistant` is a real chat UI backed by the Anthropic API, scoped to the signed-in user's own Verityio data.

## Principle

AI is an interface over trusted data, not a source of truth. Database records are the source of truth. The assistant never fabricates hours, earnings, shifts, expenses, incidents, or dates -- when data is missing, it says so rather than guessing.

## Architecture

```
User (components/assistant/chat.tsx)
 -> POST /api/assistant/chat (app/api/assistant/chat/route.ts)
 -> requireUserContext() authenticates the request and resolves the user's
    timezone/currency/workweek settings -- nothing here trusts a client-
    supplied user id
 -> lib/ai/chat.ts#runAssistantTurn -- a manual Claude tool-use loop
    (client.messages.create, not the beta Tool Runner, for a stable
    non-beta surface)
 -> Tools (lib/ai/tools.ts) query lib/data / Supabase directly, scoped to
    ctx.userId, and hand back structured JSON -- the model never sees a
    connection string or writes SQL
 -> Reply persisted to ai_conversations / ai_messages (RLS-scoped to the
    owning user) and returned to the client
```

## Model

`lib/ai/client.ts` targets `claude-opus-5` by default. Swap `ASSISTANT_MODEL` there for `claude-sonnet-5` or `claude-haiku-4-5` if you'd rather trade capability for lower per-message cost -- this is a one-line change, not an architectural one.

Requires `ANTHROPIC_API_KEY` (server-only; see `.env.example`). Get one from https://console.anthropic.com/settings/keys and add it to `.env.local` locally and to the Vercel project's environment variables in production. Until it's set, `/assistant` will show a "couldn't respond" error rather than crash the app.

## Tools

Every tool in `lib/ai/tools.ts` is a thin wrapper over the existing `lib/calculations` + Supabase query layer, so the numbers the assistant reports are guaranteed to match what the Dashboard/Reports pages show for the same range:

- `get_hours` -- regular/overtime/total paid hours
- `get_overtime` -- overtime specifically, per job
- `get_earnings` -- estimated gross earnings (always labeled as an estimate)
- `get_shifts` -- individual shift list with computed durations
- `get_expenses` -- expense list + total, optional category filter
- `get_mileage` -- trip list + total reimbursement
- `get_schedule` -- upcoming scheduled shifts and calendar entries
- `get_journal_entries` -- work journal entries, optional type filter
- `generate_report` -- combined hours/overtime/earnings/expenses/mileage summary for broad questions

Date ranges are resolved server-side by `lib/ai/period.ts#resolvePeriod`, which reuses the same DST-safe `lib/calculations/period.ts` and `workweek.ts` boundaries the rest of the app uses -- the model picks a coarse period keyword (`this_week`, `last_month`, `custom`, etc.), never computes exact timestamps itself. This is deliberate: it keeps the assistant's numbers exactly consistent with the rest of the app instead of letting the model do its own date arithmetic.

The model is never given direct database or arbitrary-SQL access. Every fact it can report is attributable back to a named tool call.

## Conversation history

`ai_conversations` and `ai_messages` (RLS-scoped to the owning user) store the transcript. Only user/assistant text turns are persisted -- intermediate tool calls and results are not replayed across turns, since the model doesn't need to see prior tool calls to answer a new question, only prior Q&A text. `/assistant` loads the user's most recent conversation on page load and offers a "New chat" button to start fresh.

## Required response behavior (enforced via system prompt)

`lib/ai/system-prompt.ts` instructs the model to:

- Only report numbers that came from a tool call in this turn.
- Always label `get_earnings`/`generate_report` figures as gross estimates that don't represent an actual payroll deposit and don't account for taxes or deductions.
- Ask a clarifying question when a date range is ambiguous, rather than guessing.
- Say plainly when a tool returns no data, instead of inventing a plausible answer.
- Reply in the user's app language (English, French, or Spanish -- passed in from the language cookie), or in the language the user writes in, translating labels but never changing a number, date, or amount. Tool results stay in one fixed English format.
- Show dates and times in the user's time zone, converting the UTC timestamps tools return.
- Decline questions outside what its tools can answer (legal advice, actual tax filing, HR disputes) and suggest the user seek a real answer elsewhere.

Example:

> Based on your recorded shifts, your estimated gross earnings were $3,842.50. This includes 154 regular hours and 6.5 overtime hours. This is a gross estimate based on your Verityio records -- it does not represent your actual payroll deposit.

## Known limitations

- Non-streaming: the UI shows a "Thinking..." indicator rather than streaming tokens. Revisit with `client.messages.stream()` if response latency becomes an issue (see the Anthropic TypeScript SDK's streaming docs).
- No conversation list/switcher yet -- only the single most recent conversation is resumed; older ones are still in the database but not reachable from the UI.
- No rate limiting on `/api/assistant/chat` beyond Supabase auth -- add one before this is exposed to a large user base, since every message is a paid API call.

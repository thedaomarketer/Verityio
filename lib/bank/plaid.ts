import "server-only";

import { z } from "zod";

import { parseEncryptionKey } from "./token-crypto";

/**
 * Minimal server-side Plaid client over `fetch` (no SDK). Configuration:
 * - PLAID_CLIENT_ID, PLAID_SECRET: from the Plaid dashboard (Keys). Server-only.
 * - PLAID_ENV: "sandbox" (default, test banks only) or "production".
 * - BANK_TOKEN_ENCRYPTION_KEY: 32 random bytes, base64 (see token-crypto.ts).
 * Without all of them, bank linking is "not switched on" and the Budget
 * page says so (insights still work from recorded expenses).
 */

const TIMEOUT_MS = 15_000;

function baseUrl(): string {
  return process.env.PLAID_ENV?.trim() === "production" ? "https://production.plaid.com" : "https://sandbox.plaid.com";
}

function credentials(): { client_id: string; secret: string } | null {
  const clientId = process.env.PLAID_CLIENT_ID?.trim();
  const secret = process.env.PLAID_SECRET?.trim();
  return clientId && secret ? { client_id: clientId, secret } : null;
}

export function getBankEncryptionKey(): Buffer | null {
  return parseEncryptionKey(process.env.BANK_TOKEN_ENCRYPTION_KEY);
}

export function isPlaidConfigured(): boolean {
  return Boolean(credentials() && getBankEncryptionKey());
}

export class PlaidError extends Error {
  constructor(
    message: string,
    readonly code: string | null,
    readonly status: number
  ) {
    super(message);
  }
}

const errorSchema = z.object({ error_code: z.string(), error_message: z.string() });

async function plaidRequest<T>(path: string, body: Record<string, unknown>, schema: z.ZodType<T>): Promise<T> {
  const creds = credentials();
  if (!creds) throw new PlaidError("Plaid is not configured", null, 503);

  const response = await fetch(`${baseUrl()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...creds, ...body }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  const json: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const parsed = errorSchema.safeParse(json);
    throw new PlaidError(
      parsed.success ? parsed.data.error_message : `Plaid ${response.status}`,
      parsed.success ? parsed.data.error_code : null,
      response.status
    );
  }
  return schema.parse(json);
}

export async function createLinkToken(userId: string, language: string): Promise<string> {
  const result = await plaidRequest(
    "/link/token/create",
    {
      client_name: "Verityio",
      language,
      country_codes: ["US", "CA"],
      user: { client_user_id: userId },
      products: ["transactions"],
      transactions: { days_requested: 180 },
    },
    z.object({ link_token: z.string() })
  );
  return result.link_token;
}

export async function exchangePublicToken(publicToken: string): Promise<{ accessToken: string; itemId: string }> {
  const result = await plaidRequest(
    "/item/public_token/exchange",
    { public_token: publicToken },
    z.object({ access_token: z.string(), item_id: z.string() })
  );
  return { accessToken: result.access_token, itemId: result.item_id };
}

export async function removeItem(accessToken: string): Promise<void> {
  await plaidRequest("/item/remove", { access_token: accessToken }, z.object({}).passthrough());
}

const accountSchema = z.object({
  account_id: z.string(),
  name: z.string(),
  official_name: z.string().nullish(),
  mask: z.string().nullish(),
  type: z.string().nullish(),
  subtype: z.string().nullish(),
  balances: z.object({
    available: z.number().nullish(),
    current: z.number().nullish(),
    iso_currency_code: z.string().nullish(),
  }),
});
export type PlaidAccount = z.infer<typeof accountSchema>;

const transactionSchema = z.object({
  transaction_id: z.string(),
  account_id: z.string(),
  amount: z.number(),
  iso_currency_code: z.string().nullish(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  name: z.string(),
  merchant_name: z.string().nullish(),
  pending: z.boolean(),
  personal_finance_category: z.object({ primary: z.string(), detailed: z.string() }).nullish(),
});
export type PlaidTransaction = z.infer<typeof transactionSchema>;

const syncSchema = z.object({
  added: z.array(transactionSchema),
  modified: z.array(transactionSchema),
  removed: z.array(z.object({ transaction_id: z.string() })),
  accounts: z.array(accountSchema).optional().default([]),
  next_cursor: z.string(),
  has_more: z.boolean(),
});
export type PlaidSyncPage = z.infer<typeof syncSchema>;

export async function syncTransactionsPage(accessToken: string, cursor: string | null): Promise<PlaidSyncPage> {
  return plaidRequest(
    "/transactions/sync",
    { access_token: accessToken, cursor: cursor ?? undefined, count: 500 },
    syncSchema
  );
}

export async function getAccounts(accessToken: string): Promise<PlaidAccount[]> {
  const result = await plaidRequest(
    "/accounts/get",
    { access_token: accessToken },
    z.object({ accounts: z.array(accountSchema) })
  );
  return result.accounts;
}

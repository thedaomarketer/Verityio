import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { decryptToken } from "./token-crypto";
import { getAccounts, getBankEncryptionKey, PlaidError, syncTransactionsPage, type PlaidAccount, type PlaidTransaction } from "./plaid";

type Admin = ReturnType<typeof createAdminClient>;

/** Plaid errors that mean the user must reconnect (password changed, MFA expired, consent revoked). */
const RELINK_CODES = new Set(["ITEM_LOGIN_REQUIRED", "PENDING_EXPIRATION", "ACCESS_NOT_GRANTED", "USER_PERMISSION_REVOKED"]);

/** Plaid's floats rounded to cents at the boundary, so numeric(14,2) never sees float noise. */
function money(value: number | null | undefined): number | null {
  return value == null ? null : Math.round(value * 100) / 100;
}

async function upsertAccounts(admin: Admin, userId: string, itemId: string, accounts: PlaidAccount[]): Promise<Map<string, string>> {
  if (accounts.length > 0) {
    const { error } = await admin.from("bank_accounts").upsert(
      accounts.map((a) => ({
        user_id: userId,
        item_id: itemId,
        plaid_account_id: a.account_id,
        name: (a.name || a.official_name || "Account").slice(0, 255),
        mask: a.mask?.slice(0, 8) ?? null,
        type: a.type ?? null,
        subtype: a.subtype ?? null,
        current_balance: money(a.balances.current),
        available_balance: money(a.balances.available),
        iso_currency_code: a.balances.iso_currency_code?.slice(0, 3) ?? null,
      })),
      { onConflict: "plaid_account_id" }
    );
    if (error) throw new Error(`Saving accounts failed: ${error.message}`);
  }
  const { data } = await admin.from("bank_accounts").select("id, plaid_account_id").eq("item_id", itemId);
  return new Map((data ?? []).map((row) => [row.plaid_account_id, row.id]));
}

function transactionRow(userId: string, accountId: string, t: PlaidTransaction) {
  return {
    user_id: userId,
    account_id: accountId,
    plaid_transaction_id: t.transaction_id,
    date: t.date,
    name: t.name.slice(0, 500),
    merchant_name: t.merchant_name?.slice(0, 255) ?? null,
    amount: money(t.amount) ?? 0,
    iso_currency_code: t.iso_currency_code?.slice(0, 3) ?? null,
    category_primary: t.personal_finance_category?.primary ?? null,
    category_detailed: t.personal_finance_category?.detailed ?? null,
    pending: t.pending,
  };
}

export interface SyncResult {
  added: number;
  removed: number;
  status: "active" | "login_required" | "error";
}

/**
 * Pulls everything new for one linked bank (Plaid /transactions/sync, paged
 * by cursor): refreshes accounts and balances, upserts added/modified
 * transactions, deletes removed ones, then saves the cursor. Caller must have
 * already checked the item belongs to the signed-in user (or be the cron).
 */
export async function syncBankItem(itemId: string): Promise<SyncResult> {
  const key = getBankEncryptionKey();
  if (!key) throw new Error("Bank linking is not configured");
  const admin = createAdminClient();

  const { data: secret, error: secretError } = await admin
    .from("bank_item_secrets")
    .select("user_id, access_token_ciphertext, sync_cursor")
    .eq("item_id", itemId)
    .single();
  if (secretError || !secret) throw new Error("Bank connection not found");

  const userId = secret.user_id;
  const accessToken = decryptToken(secret.access_token_ciphertext, key);
  let cursor = secret.sync_cursor;
  let added = 0;
  let removed = 0;

  try {
    let accountIds = await upsertAccounts(admin, userId, itemId, await getAccounts(accessToken));

    for (let page = 0; page < 50; page++) {
      const result = await syncTransactionsPage(accessToken, cursor);
      if (result.accounts.length > 0) accountIds = await upsertAccounts(admin, userId, itemId, result.accounts);

      const rows = [...result.added, ...result.modified].flatMap((t) => {
        const accountId = accountIds.get(t.account_id);
        return accountId ? [transactionRow(userId, accountId, t)] : [];
      });
      if (rows.length > 0) {
        const { error } = await admin.from("bank_transactions").upsert(rows, { onConflict: "plaid_transaction_id" });
        if (error) throw new Error(`Saving transactions failed: ${error.message}`);
      }
      if (result.removed.length > 0) {
        const { error } = await admin
          .from("bank_transactions")
          .delete()
          .eq("user_id", userId)
          .in(
            "plaid_transaction_id",
            result.removed.map((r) => r.transaction_id)
          );
        if (error) throw new Error(`Removing transactions failed: ${error.message}`);
      }

      added += result.added.length;
      removed += result.removed.length;
      cursor = result.next_cursor;
      // Save progress after every page so a timeout never re-downloads history.
      await admin.from("bank_item_secrets").update({ sync_cursor: cursor }).eq("item_id", itemId);
      if (!result.has_more) break;
    }

    await admin.from("bank_items").update({ status: "active", last_synced_at: new Date().toISOString() }).eq("id", itemId);
    return { added, removed, status: "active" };
  } catch (error) {
    const status = error instanceof PlaidError && error.code && RELINK_CODES.has(error.code) ? "login_required" : "error";
    await admin.from("bank_items").update({ status }).eq("id", itemId);
    console.error("Bank sync failed", itemId, error instanceof Error ? error.message : error);
    return { added, removed, status };
  }
}

/** For the scheduler: re-sync every linked bank not refreshed in the last `staleHours`. */
export async function syncStaleBankItems(staleHours = 6, limit = 25): Promise<number> {
  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - staleHours * 3_600_000).toISOString();
  const { data } = await admin
    .from("bank_items")
    .select("id")
    .eq("status", "active")
    .or(`last_synced_at.is.null,last_synced_at.lt.${cutoff}`)
    .limit(limit);
  for (const item of data ?? []) await syncBankItem(item.id);
  return data?.length ?? 0;
}

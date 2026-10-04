import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { decryptToken } from "./token-crypto";
import { getBankEncryptionKey, removeItem } from "./plaid";

/**
 * Revokes linked banks at Plaid (so Plaid stops pulling data and billing
 * for them) and deletes them here -- accounts, transactions and the
 * encrypted token cascade. Revocation is best effort: a failure at Plaid is
 * logged, but the local data is still deleted.
 */
export async function revokeBankItems(userId: string, itemIds?: string[]): Promise<void> {
  const admin = createAdminClient();
  let query = admin.from("bank_item_secrets").select("item_id, access_token_ciphertext").eq("user_id", userId);
  if (itemIds) query = query.in("item_id", itemIds);
  const { data: secrets } = await query;
  const key = getBankEncryptionKey();

  for (const secret of secrets ?? []) {
    if (key) {
      try {
        await removeItem(decryptToken(secret.access_token_ciphertext, key));
      } catch (error) {
        console.error("Plaid item removal failed", secret.item_id, error instanceof Error ? error.message : error);
      }
    }
    await admin.from("bank_items").delete().eq("id", secret.item_id).eq("user_id", userId);
  }
}

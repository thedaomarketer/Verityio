"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getI18n } from "@/lib/i18n/server";
import { hasFeature } from "@/lib/data/subscription";
import { createLinkToken, exchangePublicToken, getBankEncryptionKey, isPlaidConfigured } from "@/lib/bank/plaid";
import { encryptToken } from "@/lib/bank/token-crypto";
import { syncBankItem } from "@/lib/bank/sync";
import { revokeBankItems } from "@/lib/bank/revoke";

export interface BankActionResult {
  error?: string;
  success?: boolean;
  linkToken?: string;
}

/** Session + Premium + configuration checks shared by every bank action. */
async function authorize(): Promise<{ userId: string } | { error: string }> {
  const { m } = await getI18n();
  if (!isPlaidConfigured()) return { error: m.budget.bankNotConfigured };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: m.errors.mustSignIn };
  if (!(await hasFeature(user.id, "bank"))) return { error: m.errors.premiumRequired };
  return { userId: user.id };
}

export async function createLinkTokenAction(): Promise<BankActionResult> {
  const auth = await authorize();
  if ("error" in auth) return auth;
  const { locale, m } = await getI18n();
  try {
    return { linkToken: await createLinkToken(auth.userId, locale) };
  } catch (error) {
    console.error("Plaid link token failed", error instanceof Error ? error.message : error);
    return { error: m.budget.connectFailed };
  }
}

const connectSchema = z.object({
  publicToken: z.string().min(1).max(500),
  institutionId: z.string().max(255).nullish(),
  institutionName: z.string().max(255).nullish(),
});

/**
 * Finishes Plaid Link: swaps the one-time public token for an access token
 * (server-to-server), stores it encrypted, and pulls the first batch of
 * transactions.
 */
export async function connectBankAction(input: {
  publicToken: string;
  institutionId?: string | null;
  institutionName?: string | null;
}): Promise<BankActionResult> {
  const auth = await authorize();
  if ("error" in auth) return auth;
  const { m } = await getI18n();
  const parsed = connectSchema.safeParse(input);
  const key = getBankEncryptionKey();
  if (!parsed.success || !key) return { error: m.budget.connectFailed };

  try {
    const { accessToken, itemId: plaidItemId } = await exchangePublicToken(parsed.data.publicToken);
    const admin = createAdminClient();
    const { data: item, error } = await admin
      .from("bank_items")
      .upsert(
        {
          user_id: auth.userId,
          plaid_item_id: plaidItemId,
          institution_id: parsed.data.institutionId ?? null,
          institution_name: parsed.data.institutionName ?? null,
          status: "active",
        },
        { onConflict: "plaid_item_id" }
      )
      .select("id")
      .single();
    if (error || !item) throw new Error(error?.message ?? "Could not save bank");

    const { error: secretError } = await admin.from("bank_item_secrets").upsert(
      { item_id: item.id, user_id: auth.userId, access_token_ciphertext: encryptToken(accessToken, key), sync_cursor: null },
      { onConflict: "item_id" }
    );
    if (secretError) throw new Error(secretError.message);

    await syncBankItem(item.id);
  } catch (error) {
    console.error("Connecting bank failed", error instanceof Error ? error.message : error);
    return { error: m.budget.connectFailed };
  }

  revalidatePath("/budget");
  return { success: true };
}

/** Refreshes the user's linked banks (skipping any synced in the last two minutes). */
export async function syncBanksAction(): Promise<BankActionResult> {
  const auth = await authorize();
  if ("error" in auth) return auth;
  const supabase = await createClient();
  const recent = new Date(Date.now() - 2 * 60_000).toISOString();
  const { data: items } = await supabase
    .from("bank_items")
    .select("id, last_synced_at")
    .eq("user_id", auth.userId);

  for (const item of items ?? []) {
    if (item.last_synced_at && item.last_synced_at > recent) continue;
    await syncBankItem(item.id);
  }
  revalidatePath("/budget");
  return { success: true };
}

export async function disconnectBankAction(itemId: string): Promise<BankActionResult> {
  const { m } = await getI18n();
  if (!z.uuid().safeParse(itemId).success) return { error: m.budget.disconnectFailed };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: m.errors.mustSignIn };

  // Ownership is proven by reading the item through RLS (no Premium check:
  // anyone can always disconnect, even after their subscription ends).
  const { data: item } = await supabase.from("bank_items").select("id").eq("id", itemId).eq("user_id", user.id).maybeSingle();
  if (!item) return { error: m.budget.disconnectFailed };

  await revokeBankItems(user.id, [item.id]);
  revalidatePath("/budget");
  return { success: true };
}

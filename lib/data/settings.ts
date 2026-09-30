import "server-only";

import type { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

type Supabase = Awaited<ReturnType<typeof createClient>>;
export type UserSettingsRow = Database["public"]["Tables"]["user_settings"]["Row"];

/**
 * The user's settings row, creating it with defaults if it's missing.
 *
 * The signup trigger normally creates it, but migration 18 briefly dropped
 * that insert (fixed and backfilled in migration 19). Pages must never render
 * blank because a row is absent, so they read settings through here. RLS
 * (`user_settings_insert_own`) scopes the insert to the signed-in user.
 */
export async function getOrCreateUserSettings(supabase: Supabase, userId: string): Promise<UserSettingsRow | null> {
  const { data: existing } = await supabase.from("user_settings").select("*").eq("user_id", userId).maybeSingle();
  if (existing) return existing;

  await supabase.from("user_settings").upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true });
  const { data: created } = await supabase.from("user_settings").select("*").eq("user_id", userId).maybeSingle();
  return created;
}

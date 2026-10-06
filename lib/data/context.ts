import "server-only";

import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import { safeTimeZone } from "@/lib/timezone";

export interface UserContext {
  userId: string;
  timezone: string;
  weekStartsOn: number;
  currency: string;
}

export interface AuthUser {
  id: string;
  email: string | null;
}

/**
 * The signed-in user, from the session's verified JWT. `getClaims()` checks
 * the signature locally against Supabase's published keys (falling back to
 * asking the Auth server for a legacy shared-secret project), so it's
 * usually free -- and `cache` shares one check between the layout, the page
 * and every helper in the same request instead of three Auth round trips.
 * Data access is still enforced by RLS on the same token.
 */
export const getAuthUser = cache(async (): Promise<AuthUser | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = error ? null : data?.claims;
  if (!claims || typeof claims.sub !== "string") return null;
  return { id: claims.sub, email: typeof claims.email === "string" ? claims.email : null };
});

/** The profile columns the app shell and calculations need, loaded once per request. */
export const getShellProfile = cache(async (userId: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("full_name, email, timezone, currency, avatar_url")
    .eq("id", userId)
    .maybeSingle();
  return data;
});

/** Loads the current user plus the settings needed to run calculations. Cached per request. */
export const requireUserContext = cache(async (): Promise<UserContext | null> => {
  const user = await getAuthUser();
  if (!user) return null;

  const supabase = await createClient();
  const [profile, { data: settings }] = await Promise.all([
    getShellProfile(user.id),
    supabase.from("user_settings").select("week_starts_on").eq("user_id", user.id).maybeSingle(),
  ]);

  return {
    userId: user.id,
    // Belt and braces: the DB rejects invalid zones, but never let one crash every page.
    timezone: safeTimeZone(profile?.timezone),
    currency: profile?.currency || "USD",
    weekStartsOn: settings?.week_starts_on ?? 1,
  };
});

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. Copy .env.example to .env.local and fill in your Supabase project's values.`
    );
  }
  return value;
}

export function getSupabaseUrl(): string {
  return requireEnv("NEXT_PUBLIC_SUPABASE_URL");
}

export function getSupabaseAnonKey(): string {
  return requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

/**
 * Server-only. Never import this from a Client Component.
 *
 * Accepts either the legacy JWT service-role key or the newer `sb_secret_...`
 * secret key that the Vercel Supabase integration provisions as
 * `SUPABASE_SECRET_KEY` -- both bypass RLS and work with the admin API. An
 * empty value counts as missing.
 */
export function getSupabaseServiceRoleKey(): string {
  const value = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_SECRET_KEY?.trim();
  if (!value) {
    throw new Error(
      "Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY). " +
        "Copy .env.example to .env.local and fill in your Supabase project's values."
    );
  }
  return value;
}

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. Copy .env.example to .env.local and fill in your Supabase project's values.`
    );
  }
  return value;
}

// Each NEXT_PUBLIC_ variable is read by its literal name: Next.js only
// inlines `process.env.NEXT_PUBLIC_X` into browser code when it's written out
// like this. A dynamic lookup (`process.env[name]`) is undefined in the
// browser, which silently broke every browser-side Supabase call (photo and
// receipt uploads) while the server side kept working.

export function getSupabaseUrl(): string {
  return required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
}

export function getSupabaseAnonKey(): string {
  return required("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
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

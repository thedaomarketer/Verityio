import { type EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { isLocale } from "@/lib/i18n/config";
import { setLocaleCookie } from "@/lib/i18n/server";
import { safeRedirectPath } from "@/lib/safe-redirect";

/**
 * Where Supabase email links land (sign-up confirmation, magic link,
 * password recovery). Two link formats exist:
 * - `?token_hash=&type=` -- when the email template links here directly.
 * - `?code=` -- Supabase's default template: Supabase verifies the email
 *   first, then redirects here with a PKCE code to exchange for a session.
 *   The exchange needs a cookie from the browser that signed up, so it fails
 *   when the email is opened on another device -- but the address is already
 *   confirmed by then, so we say so instead of reporting an error.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  // `next` rides along in the emailed link, so it is attacker-controllable.
  const next = safeRedirectPath(searchParams.get("next"), "/dashboard");

  const supabase = await createClient();

  if (token_hash && type) {
    const { data, error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      await syncLocale(supabase, data.user?.id);
      redirect(type === "recovery" ? "/update-password" : next);
    }
    redirect("/login?error=confirmation-failed");
  }

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      await syncLocale(supabase, data.user?.id);
      redirect(type === "recovery" ? "/update-password" : next);
    }
    redirect("/login?confirmed=1");
  }

  redirect("/");
}

async function syncLocale(supabase: Awaited<ReturnType<typeof createClient>>, userId: string | undefined) {
  if (!userId) return;
  const { data: profile } = await supabase.from("profiles").select("locale").eq("id", userId).maybeSingle();
  if (isLocale(profile?.locale)) await setLocaleCookie(profile.locale);
}

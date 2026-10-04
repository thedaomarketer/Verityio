import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { ATTACHMENTS_BUCKET } from "@/lib/uploads/paths";

/**
 * The signed-in user's profile photo, via a short-lived signed URL. Pages
 * reference `/api/avatar?v=<path>` so the browser re-fetches when the photo
 * changes; the redirect itself is cached privately for a few minutes.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse(null, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("avatar_url").eq("id", user.id).maybeSingle();
  if (!profile?.avatar_url) return new NextResponse(null, { status: 404 });

  const { data } = await supabase.storage.from(ATTACHMENTS_BUCKET).createSignedUrl(profile.avatar_url, 3600);
  if (!data?.signedUrl) return new NextResponse(null, { status: 404 });

  const response = NextResponse.redirect(data.signedUrl, 302);
  response.headers.set("Cache-Control", "private, max-age=300");
  return response;
}

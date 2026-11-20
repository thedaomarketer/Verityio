import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/data/context";
import { ATTACHMENTS_BUCKET, isOwnAvatarPath } from "@/lib/uploads/paths";

/**
 * The signed-in user's profile photo. Pages reference
 * `/api/avatar?v=<storage path>`, and the path changes whenever the photo
 * does, so the image itself is served with a long private cache: the header
 * avatar on every page then comes from the phone's cache instead of a fresh
 * signed URL and download each time.
 */
export async function GET(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return new NextResponse(null, { status: 401 });

  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("avatar_url").eq("id", user.id).maybeSingle();
  const path = profile?.avatar_url;
  if (!path || !isOwnAvatarPath(user.id, path)) return new NextResponse(null, { status: 404 });

  const { data: file } = await supabase.storage.from(ATTACHMENTS_BUCKET).download(path);
  if (!file) return new NextResponse(null, { status: 404 });

  // Only cache for a year when the URL names this exact photo; otherwise briefly.
  const versioned = request.nextUrl.searchParams.get("v") === path;
  return new NextResponse(file.stream(), {
    headers: {
      "Content-Type": file.type || "image/jpeg",
      "Cache-Control": versioned ? "private, max-age=31536000, immutable" : "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

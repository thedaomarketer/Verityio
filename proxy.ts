import { NextResponse, type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

/**
 * Addresses the app used before the rename to Verityio. Visitors (and old
 * links in emails or bookmarks) are sent to the same path on the current
 * address. Per-deployment preview URLs are untouched.
 */
const LEGACY_HOSTS = new Set(["workledger-three.vercel.app", "workledgerio.vercel.app", "verity-work.vercel.app"]);

function canonicalHost(): string | null {
  try {
    return process.env.NEXT_PUBLIC_SITE_URL ? new URL(process.env.NEXT_PUBLIC_SITE_URL).host : null;
  } catch {
    return null;
  }
}

export function proxy(request: NextRequest) {
  const host = request.headers.get("host");
  const target = canonicalHost();
  // API calls are never redirected: the reminder scheduler (pg_net) doesn't
  // follow redirects, and a POST must reach the handler where it was sent.
  const isApi = request.nextUrl.pathname.startsWith("/api/");
  if (host && target && host !== target && LEGACY_HOSTS.has(host) && !isApi) {
    const url = request.nextUrl.clone();
    url.protocol = "https:";
    url.host = target;
    url.port = "";
    return NextResponse.redirect(url, 308);
  }
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - image files
     * - manifest.webmanifest / sw.js / push/ (PWA and OneSignal service
     *   worker files the browser fetches unauthenticated, and which must
     *   never redirect to /login)
     */
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|push/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

import { type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

export function proxy(request: NextRequest) {
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

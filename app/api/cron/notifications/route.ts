import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

import { isPushConfigured } from "@/lib/push/onesignal";
import { runReminders } from "@/lib/push/reminders";

export const maxDuration = 60;

/** Constant-time check of `Authorization: Bearer <CRON_SECRET>`. */
function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  const header = request.headers.get("authorization") ?? "";
  if (!secret || !header.startsWith("Bearer ")) return false;
  const given = Buffer.from(header.slice("Bearer ".length));
  const expected = Buffer.from(secret);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * The push reminder scheduler. Called every 15 minutes by Supabase pg_cron
 * (migration 22) -- which works on any Vercel plan, unlike sub-daily Vercel
 * Cron. Public in the proxy, but useless without CRON_SECRET.
 */
async function handle(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isPushConfigured()) {
    return NextResponse.json({ skipped: "push notifications are not configured" });
  }

  try {
    const summary = await runReminders();
    return NextResponse.json(summary);
  } catch (error) {
    console.error("Reminder run failed", error);
    return NextResponse.json({ error: "Reminder run failed" }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;

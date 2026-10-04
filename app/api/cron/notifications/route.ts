import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

import { isPushConfigured } from "@/lib/push/onesignal";
import { runReminders } from "@/lib/push/reminders";
import { isPlaidConfigured } from "@/lib/bank/plaid";
import { syncStaleBankItems } from "@/lib/bank/sync";

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
 * The scheduler: push reminders, plus a refresh of linked banks that
 * haven't synced in six hours. Called every 15 minutes by Supabase pg_cron
 * (migration 22) -- which works on any Vercel plan, unlike sub-daily Vercel
 * Cron. Public in the proxy, but useless without CRON_SECRET. Each job runs
 * only when its service is configured.
 */
async function handle(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result: Record<string, unknown> = {};
  let failed = false;

  if (isPushConfigured()) {
    try {
      result.reminders = await runReminders();
    } catch (error) {
      console.error("Reminder run failed", error);
      result.reminders = "failed";
      failed = true;
    }
  } else {
    result.reminders = "skipped: push notifications are not configured";
  }

  if (isPlaidConfigured()) {
    try {
      result.banksSynced = await syncStaleBankItems();
    } catch (error) {
      console.error("Bank sync run failed", error);
      result.banksSynced = "failed";
      failed = true;
    }
  } else {
    result.banksSynced = "skipped: bank linking is not configured";
  }

  return NextResponse.json(result, { status: failed ? 500 : 200 });
}

export const GET = handle;
export const POST = handle;

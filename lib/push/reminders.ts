import "server-only";

import { dueReminders, getNextPayday, holidayDisplayName, holidaysByDate, holidaysForRegion, localDateString, type DueReminder } from "@/lib/calculations";
import type { PayFrequency } from "@/lib/calculations/payday";
import { formatMinutesAsHours } from "@/lib/format";
import { fmt, isLocale, type Locale } from "@/lib/i18n/config";
import { MESSAGES } from "@/lib/i18n/messages";
import { fetchPublicHolidays, type HolidayCountry } from "@/lib/holidays/nager";
import { createAdminClient } from "@/lib/supabase/admin";
import { safeTimeZone } from "@/lib/timezone";
import { sendPush } from "./onesignal";

export interface ReminderRunSummary {
  users: number;
  due: number;
  sent: number;
  failed: number;
}

/**
 * One pass of the reminder scheduler (called every 15 minutes, see
 * app/api/cron/notifications). Only users with at least one linked device and
 * the Notifications preference on are considered. Each reminder is claimed in
 * notification_deliveries before sending, so overlapping runs can't double-send;
 * a failed send releases the claim so the next run retries.
 */
export async function runReminders(now: Date = new Date()): Promise<ReminderRunSummary> {
  const admin = createAdminClient();
  const summary: ReminderRunSummary = { users: 0, due: 0, sent: 0, failed: 0 };

  const { data: subscriptions, error: subscriptionsError } = await admin
    .from("push_subscriptions")
    .select("user_id, onesignal_id");
  if (subscriptionsError) throw subscriptionsError;

  const devicesByUser = new Map<string, string[]>();
  for (const s of subscriptions ?? []) {
    devicesByUser.set(s.user_id, [...(devicesByUser.get(s.user_id) ?? []), s.onesignal_id]);
  }
  if (devicesByUser.size === 0) return summary;

  const { data: settingsRows } = await admin
    .from("user_settings")
    .select("user_id, notifications_enabled, tax_country, tax_region")
    .in("user_id", [...devicesByUser.keys()])
    .eq("notifications_enabled", true);
  const userIds = (settingsRows ?? []).map((s) => s.user_id);
  summary.users = userIds.length;
  if (userIds.length === 0) return summary;

  const [{ data: profiles }, { data: activeShifts }, { data: openBreaks }, { data: jobs }] = await Promise.all([
    admin.from("profiles").select("id, timezone, locale").in("id", userIds),
    admin.from("shifts").select("id, user_id, actual_start, job:jobs(name)").eq("status", "active").in("user_id", userIds),
    admin.from("breaks").select("id, user_id, started_at").is("ended_at", null).in("user_id", userIds),
    admin
      .from("jobs")
      .select("id, user_id, name, pay_frequency, pay_anchor_date")
      .eq("is_active", true)
      .not("pay_frequency", "is", null)
      .not("pay_anchor_date", "is", null)
      .in("user_id", userIds),
  ]);

  // Holiday lists per country/year (each fetch is cached for a week).
  const holidayCache = new Map<string, Awaited<ReturnType<typeof fetchPublicHolidays>>>();
  async function holidayNamesFor(country: HolidayCountry, region: string | null, timezone: string, locale: Locale) {
    const year = Number(localDateString(now, timezone).slice(0, 4));
    const key = `${country}:${year}`;
    if (!holidayCache.has(key)) holidayCache.set(key, await fetchPublicHolidays(year, country));
    const byDate = holidaysByDate(holidaysForRegion(holidayCache.get(key) ?? [], country, region));
    return new Map([...byDate].map(([date, h]) => [date, holidayDisplayName(h, locale)]));
  }

  for (const settings of settingsRows ?? []) {
    const userId = settings.user_id;
    const profile = profiles?.find((p) => p.id === userId);
    const timezone = safeTimeZone(profile?.timezone);
    const locale: Locale = isLocale(profile?.locale) ? profile.locale : "en";
    const m = MESSAGES[locale];

    const shift = activeShifts?.find((s) => s.user_id === userId && s.actual_start);
    const openBreak = openBreaks?.find((b) => b.user_id === userId);
    const paydays = (jobs ?? [])
      .filter((j) => j.user_id === userId)
      .map((j) => ({
        jobId: j.id,
        jobName: j.name,
        nextPayday: getNextPayday(j.pay_anchor_date!, j.pay_frequency as PayFrequency, timezone, now),
      }));

    const holidayNames =
      settings.tax_country && paydays.length > 0
        ? await holidayNamesFor(settings.tax_country, settings.tax_region, timezone, locale)
        : new Map<string, string>();

    const due = dueReminders({
      now,
      timezone,
      activeShift: shift ? { id: shift.id, startedAt: shift.actual_start!, jobName: shift.job?.name ?? "" } : null,
      openBreak: openBreak ? { id: openBreak.id, startedAt: openBreak.started_at } : null,
      paydays,
      holidayNames,
    });
    summary.due += due.length;

    for (const reminder of due) {
      const { data: claimed } = await admin
        .from("notification_deliveries")
        .upsert(
          { user_id: userId, kind: reminder.kind, dedupe_key: reminder.dedupeKey },
          { onConflict: "user_id,dedupe_key", ignoreDuplicates: true }
        )
        .select("id");
      if (!claimed || claimed.length === 0) continue; // already sent

      const sent = await sendPush({ subscriptionIds: devicesByUser.get(userId) ?? [], ...messageFor(reminder, m, locale) });
      if (sent) {
        summary.sent++;
      } else {
        summary.failed++;
        await admin.from("notification_deliveries").delete().eq("id", claimed[0].id);
      }
    }
  }

  return summary;
}

function messageFor(reminder: DueReminder, m: (typeof MESSAGES)[Locale], locale: Locale) {
  const n = m.notifications;
  switch (reminder.kind) {
    case "long_shift":
      return {
        title: n.longShiftTitle,
        body: fmt(n.longShiftBody, { job: reminder.jobName, duration: formatMinutesAsHours(reminder.minutes, locale) }),
        path: "/time",
      };
    case "long_break":
      return {
        title: n.longBreakTitle,
        body: fmt(n.longBreakBody, { duration: formatMinutesAsHours(reminder.minutes, locale) }),
        path: "/time",
      };
    case "payday":
      return {
        title: n.paydayTitle,
        body: reminder.holidayName
          ? fmt(n.paydayHolidayBody, { job: reminder.jobName, holiday: reminder.holidayName })
          : fmt(n.paydayBody, { job: reminder.jobName }),
        path: "/taxes",
      };
  }
}

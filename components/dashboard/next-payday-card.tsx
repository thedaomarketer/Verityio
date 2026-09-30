import Link from "next/link";
import { CalendarClock, ChevronRight } from "lucide-react";

import type { JobPayday } from "@/lib/data/tax";
import { daysUntil, formatDaysAway, formatLongDate } from "@/lib/format";
import { getI18n } from "@/lib/i18n/server";

/**
 * A compact payday box: sized to its content (not a full-width bar), with
 * the icon in a small iOS-style tile and the countdown as a pill.
 */
export async function NextPaydayCard({ payday, timezone }: { payday: JobPayday; timezone: string }) {
  const { intl, m } = await getI18n();
  const days = daysUntil(payday.nextPayday);

  return (
    <Link
      href="/taxes"
      className="flex w-full items-center gap-3 rounded-2xl bg-card px-3.5 py-3 shadow-[0_1px_2px_rgb(0_0_0/0.04),0_1px_12px_rgb(0_0_0/0.03)] transition-colors hover:bg-accent/40 active:bg-black/[0.03] sm:w-fit sm:min-w-80"
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-[9px] bg-success/12 text-success">
        <CalendarClock className="size-[18px]" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs text-muted-foreground">
          {m.dashboard.nextPayday} · {payday.jobName}
        </span>
        <span className="block truncate text-[15px] font-semibold">
          {formatLongDate(payday.nextPayday, timezone, intl)}
        </span>
      </span>
      <span
        className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${days <= 1 ? "bg-success text-success-foreground" : "bg-muted text-foreground"}`}
      >
        {formatDaysAway(days, m)}
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground/60" aria-hidden="true" />
    </Link>
  );
}

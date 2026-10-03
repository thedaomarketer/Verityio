"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";

import { formatMinutesAsHours } from "@/lib/format";
import { fmt } from "@/lib/i18n/config";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

/**
 * How far into the workweek you are, against the overtime threshold:
 * answers "how long have I worked?" and "am I about to hit overtime?" at a
 * glance. The bar fills in on load; past the threshold the overflow shows in
 * the overtime color.
 */
export function WeekProgress({ workedMinutes, thresholdMinutes }: { workedMinutes: number; thresholdMinutes: number }) {
  const { locale, m } = useI18n();
  const d = m.dashboard;
  const [filled, setFilled] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setFilled(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const hours = (minutes: number) => formatMinutesAsHours(minutes, locale);
  const over = Math.max(0, workedMinutes - thresholdMinutes);
  // Scale so the threshold sits at 80% once you're past it, leaving room for the overtime part.
  const scale = over > 0 ? workedMinutes / 0.8 : thresholdMinutes;
  const regularPct = (Math.min(workedMinutes, thresholdMinutes) / scale) * 100;
  const overPct = (over / scale) * 100;

  return (
    <Link
      href="/reports"
      className="block rounded-2xl bg-card p-5 shadow-[0_1px_2px_rgb(0_0_0/0.04),0_1px_12px_rgb(0_0_0/0.03)] transition-colors hover:bg-accent/40 active:bg-black/[0.03]"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{d.weekProgressTitle}</p>
        <ChevronRight className="size-4 text-muted-foreground/60" aria-hidden="true" />
      </div>
      <p className="mt-1 text-lg font-semibold tracking-tight tabular-nums">
        {fmt(d.weekProgress, { worked: hours(workedMinutes), threshold: hours(thresholdMinutes) })}
      </p>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={thresholdMinutes}
        aria-valuenow={Math.min(workedMinutes, thresholdMinutes)}
        aria-label={d.weekProgressTitle}
        className="relative mt-3 flex h-2.5 overflow-hidden rounded-full bg-muted"
      >
        <div
          className="bg-primary transition-[width] duration-700 ease-out"
          style={{ width: filled ? `${regularPct}%` : "0%" }}
        />
        <div
          className="bg-chart-2 transition-[width] delay-500 duration-500 ease-out"
          style={{ width: filled ? `${overPct}%` : "0%" }}
        />
      </div>
      <p className={cn("mt-2 text-xs", over > 0 ? "font-medium text-foreground" : "text-muted-foreground")}>
        {over > 0
          ? fmt(d.inOvertime, { extra: hours(over) })
          : fmt(d.untilOvertime, { remaining: hours(thresholdMinutes - workedMinutes) })}
      </p>
    </Link>
  );
}

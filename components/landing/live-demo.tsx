"use client";

import { useEffect, useState } from "react";
import { Coffee, Play, Square } from "lucide-react";

import { earningsCentsForMinutes, formatCents } from "@/lib/calculations/money";
import { formatHms, formatMinutesAsHours } from "@/lib/format";
import { fmt } from "@/lib/i18n/config";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

type DemoState = "working" | "break" | "done";

const START_SECONDS = 3 * 3600 + 42 * 60 + 18;
const WEEK_BEFORE_MINUTES = 28 * 60 + 33; // so "This week" lands near the old static 32h 15m
const DEMO_RATE_CENTS = 2400; // $24.00/h, matches the hero copy

/**
 * The hero's phone, but live: the timer ticks, and Start break / Clock out
 * / Clock in work, updating the week's hours and estimated earnings. Purely
 * illustrative -- nothing is saved.
 */
export function LiveDemo() {
  const { locale, intl, m } = useI18n();
  const t = m.landing.mockup;
  const d = m.landing.demo;

  const [state, setState] = useState<DemoState>("working");
  const [paidSeconds, setPaidSeconds] = useState(START_SECONDS);
  const [breakSeconds, setBreakSeconds] = useState(0);
  const [bankedMinutes, setBankedMinutes] = useState(WEEK_BEFORE_MINUTES);

  useEffect(() => {
    if (state === "done") return;
    const id = setInterval(() => {
      if (state === "working") setPaidSeconds((s) => s + 1);
      else setBreakSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [state]);

  const shiftMinutes = Math.floor(paidSeconds / 60);
  const weekMinutes = bankedMinutes + (state === "done" ? 0 : shiftMinutes);
  const weekCents = earningsCentsForMinutes(weekMinutes, DEMO_RATE_CENTS);
  const date = new Date(Date.UTC(2024, 5, 11)).toLocaleDateString(intl, {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });

  function clockOut() {
    setBankedMinutes((b) => b + shiftMinutes);
    setState("done");
  }

  function clockIn() {
    setPaidSeconds(0);
    setBreakSeconds(0);
    setState("working");
  }

  const statusText = state === "working" ? t.clockedIn : state === "break" ? d.onBreak : d.shiftSaved;

  return (
    <div role="group" aria-label={d.label} className="relative mx-auto w-[280px] sm:w-[300px]">
      <div
        aria-hidden="true"
        className="absolute -inset-10 -z-10 rounded-full bg-[radial-gradient(closest-side,rgb(0_113_227/0.25),transparent)] blur-2xl"
      />
      <p className="mb-3 text-center text-xs font-medium text-muted-foreground">{d.tryIt}</p>
      <div className="rounded-[48px] bg-[#1c1c1e] p-3 shadow-[0_30px_80px_rgb(0_0_0/0.25)]">
        <div className="relative overflow-hidden rounded-[38px] bg-background px-4 pt-10 pb-6">
          <div aria-hidden="true" className="absolute top-3 left-1/2 h-6 w-24 -translate-x-1/2 rounded-full bg-[#1c1c1e]" />
          <p className="text-[11px] text-muted-foreground">{date}</p>
          <p className="text-xl font-bold tracking-tight">{t.greeting}</p>

          <div className="mt-4 rounded-2xl bg-card p-4 shadow-sm">
            <p
              aria-live="polite"
              className={cn(
                "flex items-center gap-2 text-[11px] font-medium",
                state === "working" ? "text-success" : state === "break" ? "text-warning-foreground" : "text-muted-foreground"
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "size-2 rounded-full",
                  state === "working" ? "animate-pulse bg-success" : state === "break" ? "bg-warning" : "bg-muted-foreground/50"
                )}
              />
              {statusText}
            </p>
            <p className="mt-1 text-3xl font-bold tracking-tight tabular-nums">
              {state === "break" ? formatHms(breakSeconds) : formatHms(paidSeconds)}
            </p>
            {state === "done" && (
              <p className="text-[11px] text-muted-foreground">
                {fmt(d.paidTime, { duration: formatMinutesAsHours(shiftMinutes, locale) })} ·{" "}
                {formatCents(earningsCentsForMinutes(shiftMinutes, DEMO_RATE_CENTS), "USD", intl)}
              </p>
            )}
            <div className="mt-3 grid grid-cols-2 gap-2">
              {state === "done" ? (
                <button
                  type="button"
                  onClick={clockIn}
                  className="col-span-2 flex min-h-9 items-center justify-center gap-1.5 rounded-full bg-primary text-[12px] font-semibold text-primary-foreground transition-transform active:scale-95"
                >
                  <Play className="size-3.5" aria-hidden="true" /> {d.clockIn}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setState(state === "break" ? "working" : "break")}
                    className="flex min-h-9 items-center justify-center gap-1.5 rounded-full bg-secondary px-2 text-[11px] font-semibold text-primary transition-transform active:scale-95"
                  >
                    <Coffee className="size-3.5 shrink-0" aria-hidden="true" />
                    {state === "break" ? d.endBreak : t.startBreak}
                  </button>
                  <button
                    type="button"
                    onClick={clockOut}
                    className="flex min-h-9 items-center justify-center gap-1.5 rounded-full bg-primary px-2 text-[11px] font-semibold text-primary-foreground transition-transform active:scale-95"
                  >
                    <Square className="size-3 shrink-0" aria-hidden="true" /> {t.clockOut}
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-card p-3 shadow-sm">
              <p className="text-[10px] text-muted-foreground">{t.thisWeek}</p>
              <p className="text-lg font-bold tracking-tight whitespace-nowrap tabular-nums">
                {formatMinutesAsHours(weekMinutes, locale)}
              </p>
            </div>
            <div className="rounded-2xl bg-card p-3 shadow-sm">
              <p className="text-[10px] text-muted-foreground">{t.earnings}</p>
              <p className="text-lg font-bold tracking-tight tabular-nums">{formatCents(weekCents, "USD", intl)}</p>
            </div>
          </div>

          <div aria-hidden="true" className="mt-3 rounded-2xl bg-card p-3 shadow-sm">
            <p className="text-[10px] text-muted-foreground">{t.hoursByWeek}</p>
            <div className="mt-2 flex h-16 items-end gap-2">
              {[45, 70, 55, 90, Math.min(100, Math.round(weekMinutes / 26))].map((h, i) => (
                <div key={i} className="flex flex-1 flex-col-reverse gap-0.5">
                  <div
                    className={cn("rounded-t-[3px] bg-chart-1 transition-[height] duration-700", i === 4 && "bg-primary")}
                    style={{ height: `${h * 0.55}px` }}
                  />
                  {i === 3 && <div className="rounded-t-[3px] bg-chart-2" style={{ height: "8px" }} />}
                </div>
              ))}
            </div>
          </div>

          <div aria-hidden="true" className="mx-auto mt-5 h-1 w-24 rounded-full bg-foreground/80" />
        </div>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { ArrowRight } from "lucide-react";

import { calculateEarnings } from "@/lib/calculations/overtime";
import { dollarsToCents, formatCents } from "@/lib/calculations/money";
import { formatMinutesAsHours } from "@/lib/format";
import { fmt } from "@/lib/i18n/config";
import { useI18n } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";

const THRESHOLDS = [40, 44, 48] as const;
const MULTIPLIERS = [
  { label: "1.5×", numerator: 3, denominator: 2 },
  { label: "2×", numerator: 2, denominator: 1 },
] as const;

/**
 * "What's my week worth?" on the homepage -- runs the app's own
 * calculateEarnings (integer cents, the same overtime split as real
 * shifts), so the numbers match what Verity would record.
 */
export function PayEstimator() {
  const { locale, intl, m } = useI18n();
  const e = m.landing.estimator;
  const id = useId();
  const currency = locale === "fr" ? "CAD" : "USD";

  const [rate, setRate] = useState(24);
  const [hours, setHours] = useState(46);
  const [threshold, setThreshold] = useState<(typeof THRESHOLDS)[number]>(44);
  const [multiplier, setMultiplier] = useState(0);

  const rateCents = dollarsToCents(Math.max(0, rate || 0));
  const { numerator, denominator } = MULTIPLIERS[multiplier];
  const result = calculateEarnings(
    Math.round(hours * 60),
    { hourlyRateCents: rateCents, overtimeRateCents: Math.round((rateCents * numerator) / denominator) },
    { enabled: true, thresholdMinutes: threshold * 60 }
  );
  const overtimeShare = result.totalEarningsCents > 0 ? result.overtimeEarningsCents / result.totalEarningsCents : 0;

  return (
    <div className="grid gap-6 rounded-[32px] bg-card p-5 shadow-[0_1px_2px_rgb(0_0_0/0.04),0_8px_40px_rgb(0_0_0/0.06)] sm:p-8 lg:grid-cols-2 lg:gap-10">
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{e.title}</h2>
          <p className="mt-2 text-muted-foreground">{e.body}</p>
        </div>

        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <label htmlFor={`${id}-rate`} className="text-sm font-medium">
              {e.hourlyRate}
            </label>
            <output htmlFor={`${id}-rate`} className="text-sm font-semibold tabular-nums">
              {formatCents(rateCents, currency, intl)}
            </output>
          </div>
          <input
            id={`${id}-rate`}
            type="range"
            min={15}
            max={80}
            step={0.5}
            value={rate}
            onChange={(event) => setRate(Number(event.target.value))}
            className="h-11 w-full cursor-pointer accent-primary"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <label htmlFor={`${id}-hours`} className="text-sm font-medium">
              {e.hours}
            </label>
            <output htmlFor={`${id}-hours`} className="text-sm font-semibold tabular-nums">
              {fmt(e.hoursValue, { hours: hours.toLocaleString(intl) })}
            </output>
          </div>
          <input
            id={`${id}-hours`}
            type="range"
            min={0}
            max={70}
            step={0.5}
            value={hours}
            onChange={(event) => setHours(Number(event.target.value))}
            className="h-11 w-full cursor-pointer accent-primary"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">{e.overtimeAfter}</legend>
            <div className="flex gap-1 rounded-full bg-muted p-1">
              {THRESHOLDS.map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={threshold === value}
                  onClick={() => setThreshold(value)}
                  className={`min-h-9 flex-1 rounded-full text-sm font-medium transition-colors ${
                    threshold === value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                  }`}
                >
                  {value}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">{e.overtimeMultiplier}</legend>
            <div className="flex gap-1 rounded-full bg-muted p-1">
              {MULTIPLIERS.map((option, index) => (
                <button
                  key={option.label}
                  type="button"
                  aria-pressed={multiplier === index}
                  onClick={() => setMultiplier(index)}
                  className={`min-h-9 flex-1 rounded-full text-sm font-medium transition-colors ${
                    multiplier === index ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </fieldset>
        </div>
      </div>

      <div className="flex flex-col justify-between gap-6 rounded-3xl bg-muted/60 p-5 sm:p-6">
        <div aria-live="polite">
          <p className="text-sm text-muted-foreground">{e.gross}</p>
          <p className="mt-1 text-5xl font-bold tracking-tight tabular-nums sm:text-6xl">
            {formatCents(result.totalEarningsCents, currency, intl)}
          </p>
          <div aria-hidden="true" className="mt-5 flex h-3 overflow-hidden rounded-full bg-card">
            <div className="bg-chart-1 transition-[width] duration-300" style={{ width: `${(1 - overtimeShare) * 100}%` }} />
            <div className="bg-chart-2 transition-[width] duration-300" style={{ width: `${overtimeShare * 100}%` }} />
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-2xl bg-card p-3">
              <dt className="flex items-center gap-1.5 text-muted-foreground">
                <span aria-hidden="true" className="size-2 rounded-full bg-chart-1" /> {e.regular}
              </dt>
              <dd className="mt-1 font-semibold tabular-nums">
                {formatMinutesAsHours(result.regularMinutes, locale)} ·{" "}
                {formatCents(result.regularEarningsCents, currency, intl)}
              </dd>
            </div>
            <div className="rounded-2xl bg-card p-3">
              <dt className="flex items-center gap-1.5 text-muted-foreground">
                <span aria-hidden="true" className="size-2 rounded-full bg-chart-2" /> {e.overtime}
              </dt>
              <dd className="mt-1 font-semibold tabular-nums">
                {formatMinutesAsHours(result.overtimeMinutes, locale)} ·{" "}
                {formatCents(result.overtimeEarningsCents, currency, intl)}
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-muted-foreground">{e.disclaimer}</p>
        </div>
        <Button asChild size="lg" className="w-full">
          <Link href="/register">
            {e.cta} <ArrowRight />
          </Link>
        </Button>
      </div>
    </div>
  );
}

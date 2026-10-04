import { formatCents } from "@/lib/calculations/money";
import { formatMinutesAsHours } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";

/**
 * How a chart prints its numbers, as plain data. Client chart components
 * can't receive formatter functions from Server Components (functions don't
 * serialize), so pages pass one of these and the chart builds the formatter.
 */
export type ValueFormat =
  | { kind: "money"; currency: string; intl: string }
  | { kind: "hours"; locale: Locale };

export function makeFormatter(format: ValueFormat): (value: number) => string {
  return format.kind === "money"
    ? (cents) => formatCents(cents, format.currency, format.intl)
    : (minutes) => formatMinutesAsHours(minutes, format.locale);
}

/**
 * Axis ticks are round numbers, so money drops the cents ("$1,000", not
 * "$1,000.00"); hours are already whole on a nice scale.
 */
export function makeAxisFormatter(format: ValueFormat): (value: number) => string {
  if (format.kind === "hours") return makeFormatter(format);
  const whole = new Intl.NumberFormat(format.intl, { style: "currency", currency: format.currency, maximumFractionDigits: 0 });
  // Display only: tick values are already whole-dollar multiples from niceAxisMax.
  return (cents) => whole.format(Math.round(cents / 100));
}

import { Check, Minus } from "lucide-react";

import { getI18n } from "@/lib/i18n/server";
import type { PaidFeature, Tier } from "@/lib/billing/plans";

/** Which tiers include each comparison row (lowest tier first; higher tiers include lower ones). */
const ROWS = [
  ["tracking", "free"],
  ["overtime", "free"],
  ["payTax", "free"],
  ["expenses", "free"],
  ["shortReports", "free"],
  ["longReports", "plus"],
  ["exports", "plus"],
  ["charts", "plus"],
  ["budget", "plus"],
  ["receiptScan", "plus"],
  ["bank", "pro"],
  ["assistant", "pro"],
] as const;
const TIERS: Tier[] = ["free", "plus", "pro"];
const RANK: Record<Tier, number> = { free: 0, plus: 1, pro: 2 };
const FAQ = ["trial", "cancel", "data", "card", "currency", "team"] as const;

/** Rows that depend on a feature that may not be switched on yet. */
const ROW_FEATURE: Partial<Record<(typeof ROWS)[number][0], PaidFeature>> = {
  receiptScan: "receiptScan",
  bank: "bank",
  assistant: "assistant",
};

/** Side-by-side comparison and FAQ under the pricing cards. */
export async function PricingDetails({ featureLive }: { featureLive: Record<PaidFeature, boolean> }) {
  const { m } = await getI18n();
  const p = m.premium;
  return (
    <div className="space-y-10">
      <section aria-labelledby="compare-title" className="space-y-4">
        <h2 id="compare-title" className="text-center text-2xl font-bold tracking-tight">
          {p.compareTitle}
        </h2>
        <div className="overflow-hidden rounded-3xl bg-card shadow-[0_1px_2px_rgb(16_24_40/0.04),0_8px_24px_-12px_rgb(16_24_40/0.08)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/[0.06]">
                <th scope="col" className="px-4 py-3 text-left font-medium text-muted-foreground">
                  <span className="sr-only">{p.compareFeature}</span>
                </th>
                {TIERS.map((tier) => (
                  <th key={tier} scope="col" className="w-16 px-2 py-3 text-center font-semibold sm:w-24">
                    {p.tiers[tier].name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map(([row, minTier]) => (
                <tr key={row} className="border-b border-black/[0.06] last:border-0">
                  <th scope="row" className="px-4 py-3 text-left font-normal">
                    {p.compareRows[row]}
                    {ROW_FEATURE[row] && !featureLive[ROW_FEATURE[row]] && (
                      <span className="ml-1.5 rounded-full bg-secondary px-1.5 py-0.5 align-middle text-[11px] font-semibold text-muted-foreground">
                        {p.soon}
                      </span>
                    )}
                  </th>
                  {TIERS.map((tier) => {
                    const included = RANK[tier] >= RANK[minTier];
                    return (
                      <td key={tier} className="px-2 py-3 text-center">
                        {included ? (
                          <Check className="mx-auto size-4 text-success" aria-label={p.included} />
                        ) : (
                          <Minus className="mx-auto size-4 text-muted-foreground/50" aria-label={p.notIncluded} />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="faq-title" className="space-y-4">
        <h2 id="faq-title" className="text-center text-2xl font-bold tracking-tight">
          {p.faqTitle}
        </h2>
        <div className="divide-y divide-black/[0.06] overflow-hidden rounded-3xl bg-card shadow-[0_1px_2px_rgb(16_24_40/0.04),0_8px_24px_-12px_rgb(16_24_40/0.08)]">
          {FAQ.map((key) => (
            <details key={key} className="group px-5 py-4 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-semibold outline-none focus-visible:text-primary">
                {p.faq[key].q}
                <span aria-hidden="true" className="text-xl leading-none text-muted-foreground transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="pt-1 pb-1 text-sm text-muted-foreground">{p.faq[key].a}</p>
            </details>
          ))}
        </div>
        <p className="text-center text-sm text-muted-foreground">{p.teamNote}</p>
      </section>

      <p className="text-center text-xs text-muted-foreground">
        {p.securePayments} {p.finePrint}
      </p>
    </div>
  );
}

import "server-only";

import { formatCents } from "@/lib/calculations";
import { isAssistantConfigured } from "@/lib/ai/env";
import { isBankLinkingLive, isProAvailable } from "@/lib/billing/availability";
import {
  PRICES,
  PREMIUM_CURRENCY,
  yearlyMonthlyEquivalentCents,
  yearlySavingsPercent,
  type PaidFeature,
  type PaidTier,
} from "@/lib/billing/plans";
import type { PricingTableProps } from "@/components/pricing/pricing-table";

/** Everything the pricing table needs that doesn't depend on who's looking, formatted for `intl`. */
export function getPricingCatalog(intl: string): Pick<PricingTableProps, "prices" | "freePrice" | "proAvailable" | "featureLive"> {
  const currency = PREMIUM_CURRENCY.toUpperCase();
  const money = (cents: number) => formatCents(cents, currency, intl);
  const tierPrices = (tier: PaidTier) => ({
    month: money(PRICES[tier].month.amountCents),
    year: money(PRICES[tier].year.amountCents),
    yearPerMonth: money(yearlyMonthlyEquivalentCents(tier)),
    savePercent: yearlySavingsPercent(tier),
  });
  const assistantLive = isAssistantConfigured();
  const featureLive: Record<PaidFeature, boolean> = {
    reports: true,
    budget: true,
    receiptScan: assistantLive,
    bank: isBankLinkingLive(),
    assistant: assistantLive,
  };
  return {
    prices: { plus: tierPrices("plus"), pro: tierPrices("pro") },
    freePrice: new Intl.NumberFormat(intl, { style: "currency", currency, maximumFractionDigits: 0 }).format(0),
    proAvailable: isProAvailable(),
    featureLive,
  };
}

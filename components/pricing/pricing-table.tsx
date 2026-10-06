"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Lock, RefreshCw, ShieldCheck, Sparkles, XCircle } from "lucide-react";

import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/config";
import { TRIAL_DAYS, type BillingInterval, type PaidFeature, type PaidTier } from "@/lib/billing/plans";
import { openBillingPortalAction, startCheckoutAction } from "@/lib/actions/billing";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface TierPrices {
  /** Formatted monthly price, e.g. "$4.99". */
  month: string;
  /** Formatted yearly price, e.g. "$39.99". */
  year: string;
  /** The yearly price per month, e.g. "$3.33". */
  yearPerMonth: string;
  savePercent: number;
}

export interface PricingTableProps {
  /** "public": signed-out visitors, buttons lead to sign-up. "app": buttons start checkout or open billing. */
  mode: "public" | "app";
  billingEnabled: boolean;
  proAvailable: boolean;
  /** Which paid features already work for customers (the rest are labelled "soon"). */
  featureLive: Record<PaidFeature, boolean>;
  /** The plan the signed-in user pays for, if any. */
  subscribedTier: PaidTier | null;
  trialEligible: boolean;
  prices: Record<PaidTier, TierPrices>;
  freePrice: string;
}

const FREE_FEATURES = ["tracking", "overtime", "pay", "expenses", "reports", "export"] as const;
/** What each paid card lists (comparison-row labels), and the gated feature each depends on being live. */
const PAID_CARD_ROWS = {
  plus: [
    ["longReports", "reports"],
    ["exports", "reports"],
    ["charts", "reports"],
    ["budget", "budget"],
    ["receiptScan", "receiptScan"],
  ],
  pro: [
    ["bank", "bank"],
    ["assistant", "assistant"],
  ],
} as const satisfies Record<PaidTier, readonly (readonly [string, PaidFeature])[]>;
const TRUST = [
  { key: "free", icon: ShieldCheck },
  { key: "cancel", icon: XCircle },
  { key: "secure", icon: Lock },
  { key: "export", icon: RefreshCw },
] as const;

/**
 * The three plans side by side (stacked on phones), yearly selected by
 * default with the saving shown. Prices are formatted on the server from
 * lib/billing/plans.ts; the forms only send a tier and an interval.
 */
export function PricingTable(props: PricingTableProps) {
  const { m } = useI18n();
  const p = m.premium;
  const [interval, setInterval] = useState<BillingInterval>("year");
  const maxSave = Math.max(props.prices.plus.savePercent, props.prices.pro.savePercent);

  return (
    <div className="space-y-6">
      <div className="flex justify-center">
        <div
          role="radiogroup"
          aria-label={p.billingPeriod}
          className="inline-flex rounded-full bg-secondary p-1 shadow-[inset_0_1px_2px_rgb(0_0_0/0.06)]"
        >
          {(["month", "year"] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={interval === value}
              onClick={() => setInterval(value)}
              className={cn(
                "flex min-h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40",
                interval === value ? "bg-card text-foreground shadow-[0_1px_3px_rgb(0_0_0/0.12)]" : "text-muted-foreground"
              )}
            >
              {value === "month" ? p.monthly : p.yearly}
              {value === "year" && maxSave > 0 && (
                <span className="rounded-full bg-success/15 px-2 py-0.5 text-xs font-semibold text-[#1b6e33]">
                  {fmt(p.save, { percent: maxSave })}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3 md:items-stretch">
        <PlanCard
          className="order-2 md:order-none"
          name={p.tiers.free.name}
          tagline={p.tiers.free.tagline}
          price={props.freePrice}
          priceNote={p.freeForever}
          features={FREE_FEATURES.map((key) => ({ label: p.freeFeatures[key] }))}
          cta={<FreeCta {...props} />}
        />
        {(["plus", "pro"] as const).map((tier) => {
          const prices = props.prices[tier];
          const comingSoon = tier === "pro" && !props.proAvailable;
          return (
            <PlanCard
              key={tier}
              className={tier === "plus" ? "order-1 md:order-none" : "order-3 md:order-none"}
              name={p.tiers[tier].name}
              tagline={p.tiers[tier].tagline}
              highlight={tier === "plus"}
              badge={tier === "plus" ? p.mostPopular : comingSoon ? p.comingSoon : undefined}
              price={interval === "year" ? prices.yearPerMonth : prices.month}
              per={p.perMonth}
              priceNote={interval === "year" ? fmt(p.yearlyBilled, { total: prices.year }) : p.monthlyBilled}
              lead={tier === "plus" ? p.everythingInFree : p.everythingInPlus}
              features={PAID_CARD_ROWS[tier].map(([row, feature]) => ({
                label: p.compareRows[row],
                soon: !props.featureLive[feature],
              }))}
              cta={<PaidCta {...props} tier={tier} interval={interval} comingSoon={comingSoon} />}
              footnote={
                comingSoon
                  ? p.comingSoonBody
                  : props.subscribedTier
                    ? undefined
                    : props.trialEligible
                      ? fmt(p.trialNote, {
                          days: TRIAL_DAYS,
                          price: interval === "year" ? `${prices.year}${p.perYear}` : `${prices.month}${p.perMonth}`,
                        })
                      : p.noTrialNote
              }
            />
          );
        })}
      </div>

      <ul className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
        {TRUST.map(({ key, icon: Icon }) => (
          <li key={key} className="flex items-center gap-1.5">
            <Icon className="size-4 text-success" aria-hidden="true" />
            {p.trust[key]}
          </li>
        ))}
      </ul>
    </div>
  );
}

function PlanCard({
  name,
  tagline,
  price,
  per,
  priceNote,
  lead,
  features,
  cta,
  footnote,
  highlight,
  badge,
  className,
}: {
  className?: string;
  name: string;
  tagline: string;
  price: string;
  per?: string;
  priceNote: string;
  lead?: string;
  features: { label: string; soon?: boolean }[];
  cta: React.ReactNode;
  footnote?: string;
  highlight?: boolean;
  badge?: string;
}) {
  const { m } = useI18n();
  return (
    <section
      className={cn(
        className,
        "relative flex flex-col rounded-3xl border bg-card p-6 shadow-[0_1px_2px_rgb(16_24_40/0.04),0_8px_24px_-12px_rgb(16_24_40/0.08)]",
        highlight ? "border-primary/50 ring-2 ring-primary/20 md:-my-2 md:py-8" : "border-black/[0.04]"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-bold tracking-tight">{name}</h2>
        {badge && (
          <span
            className={cn(
              "rounded-full px-2.5 py-0.5 text-xs font-semibold",
              highlight ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
            )}
          >
            {badge}
          </span>
        )}
      </div>
      <p className="mt-1 min-h-10 text-sm text-muted-foreground">{tagline}</p>
      <p className="mt-4 flex items-baseline gap-1">
        <span className="text-4xl font-bold tracking-tight tabular-nums">{price}</span>
        {per && <span className="text-sm text-muted-foreground">{per}</span>}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">{priceNote}</p>
      <div className="mt-5">{cta}</div>
      {footnote && <p className="mt-2 text-center text-xs text-muted-foreground">{footnote}</p>}
      <div className="mt-6 border-t border-black/[0.06] pt-5">
        {lead && <p className="mb-3 text-sm font-semibold">{lead}</p>}
        <ul className="space-y-2.5">
          {features.map((feature) => (
            <li key={feature.label} className="flex items-start gap-2.5 text-[15px]">
              <Check className={cn("mt-0.5 size-4 shrink-0", highlight ? "text-primary" : "text-success")} aria-hidden="true" />
              <span>
                {feature.label}
                {feature.soon && (
                  <span className="ml-1.5 rounded-full bg-secondary px-1.5 py-0.5 align-middle text-[11px] font-semibold text-muted-foreground">
                    {m.premium.soon}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function FreeCta({ mode, subscribedTier }: PricingTableProps) {
  const { m } = useI18n();
  if (mode === "public") {
    return (
      <Button asChild size="lg" variant="outline" className="w-full">
        <Link href="/register">{m.premium.getStartedFree}</Link>
      </Button>
    );
  }
  return (
    <Button size="lg" variant="outline" className="w-full" disabled>
      {subscribedTier ? m.premium.freeForever : m.premium.currentPlan}
    </Button>
  );
}

function PaidCta({
  mode,
  billingEnabled,
  subscribedTier,
  trialEligible,
  tier,
  interval,
  comingSoon,
}: PricingTableProps & { tier: PaidTier; interval: BillingInterval; comingSoon: boolean }) {
  const { m } = useI18n();
  const p = m.premium;
  const variant = tier === "plus" ? "default" : "outline";
  const label = trialEligible ? fmt(p.startTrial, { days: TRIAL_DAYS }) : fmt(p.choose, { plan: p.tiers[tier].name });

  if (comingSoon) {
    return (
      <Button size="lg" variant="outline" className="w-full" disabled>
        {p.comingSoon}
      </Button>
    );
  }
  if (mode === "public") {
    return (
      <Button asChild size="lg" variant={variant} className="w-full">
        <Link href="/register">
          {tier === "plus" && <Sparkles />} {label}
        </Link>
      </Button>
    );
  }
  if (subscribedTier === tier) {
    return (
      <Button size="lg" variant="outline" className="w-full" disabled>
        {p.currentPlan}
      </Button>
    );
  }
  if (subscribedTier) {
    // Already paying for the other tier: switching happens in Stripe's billing portal (prorated).
    return (
      <form action={openBillingPortalAction}>
        <Button type="submit" size="lg" variant={variant} className="w-full">
          {p.switchPlan}
        </Button>
      </form>
    );
  }
  return (
    <form action={startCheckoutAction}>
      <input type="hidden" name="tier" value={tier} />
      <input type="hidden" name="interval" value={interval} />
      <Button type="submit" size="lg" variant={variant} className="w-full" disabled={!billingEnabled}>
        {tier === "plus" && <Sparkles />} {label}
      </Button>
    </form>
  );
}

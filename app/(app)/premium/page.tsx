import { redirect } from "next/navigation";
import { Bot, Check, CircleAlert, CircleCheck, Crown, Landmark, LineChart, Lock, Wallet } from "lucide-react";

import { requireUserContext } from "@/lib/data/context";
import { getEntitlement } from "@/lib/data/subscription";
import { getI18n } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n/config";
import { formatCents } from "@/lib/calculations";
import { formatDate } from "@/lib/format";
import {
  PLANS,
  PREMIUM_FEATURES,
  yearlyMonthlyEquivalentCents,
  yearlySavingsPercent,
  type PlanId,
  type PremiumFeature,
} from "@/lib/billing/plans";
import { statusGrantsPremium } from "@/lib/billing/entitlements";
import { openBillingPortalAction, startCheckoutAction } from "@/lib/actions/billing";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const FEATURE_ICONS: Record<PremiumFeature, typeof Landmark> = {
  bank: Landmark,
  budget: Wallet,
  assistant: Bot,
  reports: LineChart,
};

export default async function PremiumPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string; error?: string }>;
}) {
  const [params, ctx, { intl, m }] = await Promise.all([searchParams, requireUserContext(), getI18n()]);
  if (!ctx) redirect("/login");
  const entitlement = await getEntitlement(ctx.userId);
  const subscribed = statusGrantsPremium(entitlement.status);
  const price = (cents: number) => formatCents(cents, "USD", intl);

  const notice =
    params.checkout === "success"
      ? { tone: "success" as const, text: m.premium.checkoutSuccess }
      : params.checkout === "cancelled"
        ? { tone: "info" as const, text: m.premium.checkoutCancelled }
        : params.error === "checkout"
          ? { tone: "error" as const, text: m.premium.checkoutError }
          : params.error === "portal"
            ? { tone: "error" as const, text: m.premium.portalError }
            : null;

  const plans: { id: PlanId; name: string; price: string; per: string; detail: string; badge?: string }[] = [
    {
      id: "yearly",
      name: m.premium.yearly,
      price: price(PLANS.yearly.amountCents),
      per: m.premium.perYear,
      detail: fmt(m.premium.yearlyEquivalent, { price: price(yearlyMonthlyEquivalentCents()) }),
      badge: fmt(m.premium.save, { percent: yearlySavingsPercent() }),
    },
    {
      id: "monthly",
      name: m.premium.monthly,
      price: price(PLANS.monthly.amountCents),
      per: m.premium.perMonth,
      detail: m.premium.monthlyDetail,
    },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <section className="hero-surface relative overflow-hidden rounded-3xl px-6 py-8 text-center shadow-[0_18px_40px_-18px_rgb(10_30_80/0.55)] md:py-10">
        <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-[linear-gradient(150deg,#ffd36b_0%,#f5a623_55%,#d97a00_100%)] shadow-[inset_0_1px_0_rgb(255_255_255/0.4),0_8px_20px_-6px_rgb(245_166_35/0.6)]">
          <Crown className="size-7 text-white" aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-[28px] leading-tight font-bold tracking-tight md:text-4xl">{m.premium.title}</h1>
        <p className="mx-auto mt-2 max-w-md text-[15px] text-white/80">{m.premium.tagline}</p>
      </section>

      {notice && (
        <p
          role="status"
          className={cn(
            "flex items-start gap-2 rounded-2xl px-4 py-3 text-sm",
            notice.tone === "success" && "bg-success/10 text-[#1b6e33]",
            notice.tone === "info" && "bg-secondary text-foreground",
            notice.tone === "error" && "bg-destructive/10 text-destructive"
          )}
        >
          {notice.tone === "error" ? (
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          ) : (
            <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          )}
          {notice.text}
        </p>
      )}

      {!entitlement.billingEnabled && (
        <p className="rounded-2xl bg-secondary px-4 py-3 text-sm text-muted-foreground">{m.premium.notConfigured}</p>
      )}

      {subscribed ? (
        <Card>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-full bg-success/10 text-success">
                <Check className="size-5" aria-hidden="true" />
              </span>
              <div>
                <p className="font-semibold">{m.premium.activeTitle}</p>
                <p className="text-sm text-muted-foreground">
                  {entitlement.interval === "year" ? m.premium.yearly : m.premium.monthly}
                  {entitlement.currentPeriodEnd &&
                    ` · ${fmt(entitlement.cancelAtPeriodEnd ? m.premium.endsOn : m.premium.renewsOn, {
                      date: formatDate(entitlement.currentPeriodEnd, ctx.timezone, intl),
                    })}`}
                </p>
              </div>
            </div>
            {entitlement.status === "past_due" && (
              <p className="rounded-xl bg-warning/15 px-3 py-2 text-sm">{m.premium.pastDue}</p>
            )}
            {entitlement.hasCustomer && (
              <form action={openBillingPortalAction}>
                <Button type="submit" variant="outline">
                  {m.premium.manage}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {plans.map((plan, i) => (
            <form
              key={plan.id}
              action={startCheckoutAction}
              className={cn(
                "relative flex flex-col rounded-3xl border bg-card p-5 shadow-[0_1px_2px_rgb(16_24_40/0.04),0_8px_24px_-12px_rgb(16_24_40/0.08)]",
                i === 0 ? "border-primary/40 ring-2 ring-primary/15" : "border-black/[0.04]"
              )}
            >
              <input type="hidden" name="plan" value={plan.id} />
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-semibold">{plan.name}</h2>
                {plan.badge && (
                  <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-primary-foreground">
                    {plan.badge}
                  </span>
                )}
              </div>
              <p className="mt-3 flex items-baseline gap-1">
                <span className="text-4xl font-bold tracking-tight tabular-nums">{plan.price}</span>
                <span className="text-sm text-muted-foreground">{plan.per}</span>
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{plan.detail}</p>
              <Button
                type="submit"
                size="lg"
                variant={i === 0 ? "default" : "outline"}
                className="mt-5 w-full"
                disabled={!entitlement.billingEnabled}
              >
                {fmt(m.premium.choose, { plan: plan.name })}
              </Button>
            </form>
          ))}
        </div>
      )}

      <Card>
        <CardContent className="space-y-4">
          <h2 className="font-semibold">{m.premium.featuresTitle}</h2>
          <ul className="space-y-4">
            {PREMIUM_FEATURES.map((feature) => {
              const Icon = FEATURE_ICONS[feature];
              return (
                <li key={feature} className="flex gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="size-[18px]" aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block text-[15px] font-medium">{m.premium.features[feature].title}</span>
                    <span className="block text-sm text-muted-foreground">{m.premium.features[feature].body}</span>
                  </span>
                </li>
              );
            })}
          </ul>
          <div className="rounded-2xl bg-secondary/60 px-4 py-3">
            <p className="text-sm font-medium">{m.premium.freeTitle}</p>
            <p className="text-sm text-muted-foreground">{m.premium.freeBody}</p>
          </div>
        </CardContent>
      </Card>

      <p className="flex items-start justify-center gap-1.5 text-center text-xs text-muted-foreground">
        <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        <span>
          {m.premium.securePayments} {m.premium.finePrint}
        </span>
      </p>
    </div>
  );
}

import { redirect } from "next/navigation";
import { Check, CircleAlert, CircleCheck, CreditCard, Crown } from "lucide-react";

import { requireUserContext } from "@/lib/data/context";
import { getEntitlement } from "@/lib/data/subscription";
import { getPricingCatalog } from "@/lib/data/pricing";
import { getI18n } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n/config";
import { formatDate } from "@/lib/format";
import { openBillingPortalAction } from "@/lib/actions/billing";
import { PricingTable } from "@/components/pricing/pricing-table";
import { PricingDetails } from "@/components/pricing/pricing-details";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default async function PlansPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string; error?: string }>;
}) {
  const [params, ctx, { intl, m }] = await Promise.all([searchParams, requireUserContext(), getI18n()]);
  if (!ctx) redirect("/login");
  const entitlement = await getEntitlement(ctx.userId);
  const p = m.premium;
  const catalog = getPricingCatalog(intl);
  const subscribedTier = entitlement.subscribed ? entitlement.subscribedTier : null;

  const notice =
    params.checkout === "success"
      ? { tone: "success" as const, text: p.checkoutSuccess }
      : params.checkout === "cancelled"
        ? { tone: "info" as const, text: p.checkoutCancelled }
        : params.error === "checkout"
          ? { tone: "error" as const, text: p.checkoutError }
          : params.error === "portal"
            ? { tone: "error" as const, text: p.portalError }
            : null;

  const periodEnd = entitlement.currentPeriodEnd ? formatDate(entitlement.currentPeriodEnd, ctx.timezone, intl) : null;
  const periodLine = periodEnd
    ? fmt(
        entitlement.status === "trialing" ? p.trialEnds : entitlement.cancelAtPeriodEnd ? p.endsOn : p.renewsOn,
        { date: periodEnd }
      )
    : null;

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <section className="hero-surface relative overflow-hidden rounded-3xl px-6 py-8 text-center shadow-[0_18px_40px_-18px_rgb(10_30_80/0.55)] md:py-10">
        <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-[linear-gradient(150deg,#ffd36b_0%,#f5a623_55%,#d97a00_100%)] shadow-[inset_0_1px_0_rgb(255_255_255/0.4),0_8px_20px_-6px_rgb(245_166_35/0.6)]">
          <Crown className="size-7 text-white" aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-[28px] leading-tight font-bold tracking-tight md:text-4xl">{p.title}</h1>
        <p className="mx-auto mt-2 max-w-lg text-[15px] text-white/80">{p.tagline}</p>
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
        <p className="rounded-2xl bg-secondary px-4 py-3 text-sm text-muted-foreground">{p.notConfigured}</p>
      )}

      {(subscribedTier || entitlement.hasCustomer) && (
        <Card>
          <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-success/10 text-success">
                {subscribedTier ? <Check className="size-5" aria-hidden="true" /> : <CreditCard className="size-5" aria-hidden="true" />}
              </span>
              <div>
                <p className="font-semibold">
                  {subscribedTier ? fmt(p.activeTitle, { plan: p.tiers[subscribedTier].name }) : p.billingFree}
                </p>
                <p className="text-sm text-muted-foreground">
                  {subscribedTier && entitlement.interval && `${entitlement.interval === "year" ? p.yearly : p.monthly}`}
                  {subscribedTier && periodLine && ` · ${periodLine}`}
                  {!subscribedTier && p.manageHint}
                </p>
              </div>
            </div>
            {entitlement.hasCustomer && (
              <form action={openBillingPortalAction}>
                <Button type="submit" variant="outline" className="w-full sm:w-auto">
                  <CreditCard /> {p.manage}
                </Button>
              </form>
            )}
          </CardContent>
          {entitlement.status === "past_due" && (
            <CardContent>
              <p className="rounded-xl bg-warning/15 px-3 py-2 text-sm">{p.pastDue}</p>
            </CardContent>
          )}
        </Card>
      )}

      <PricingTable
        mode="app"
        billingEnabled={entitlement.billingEnabled}
        subscribedTier={subscribedTier}
        trialEligible={!entitlement.hadSubscription}
        {...catalog}
      />

      <PricingDetails featureLive={catalog.featureLive} />
    </div>
  );
}

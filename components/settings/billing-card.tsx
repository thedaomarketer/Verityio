import Link from "next/link";
import { CreditCard, Crown } from "lucide-react";

import { getI18n } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n/config";
import { formatDate } from "@/lib/format";
import { openBillingPortalAction } from "@/lib/actions/billing";
import type { Entitlement } from "@/lib/data/subscription";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** Current plan, renewal date, and the way into Stripe's portal for the card on file and invoices. */
export async function BillingCard({ entitlement, timezone }: { entitlement: Entitlement; timezone: string }) {
  const { intl, m } = await getI18n();
  const p = m.premium;
  const tier = entitlement.subscribed ? entitlement.subscribedTier : null;
  const periodEnd = entitlement.currentPeriodEnd ? formatDate(entitlement.currentPeriodEnd, timezone, intl) : null;
  const periodLine =
    tier && periodEnd
      ? fmt(entitlement.status === "trialing" ? p.trialEnds : entitlement.cancelAtPeriodEnd ? p.endsOn : p.renewsOn, { date: periodEnd })
      : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{p.billingTitle}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[linear-gradient(150deg,#ffd36b_0%,#f5a623_55%,#d97a00_100%)] text-white">
            <Crown className="size-5" aria-hidden="true" />
          </span>
          <div>
            <p className="font-semibold">{tier ? fmt(p.activeTitle, { plan: p.tiers[tier].name }) : p.billingFree}</p>
            {periodLine && <p className="text-sm text-muted-foreground">{periodLine}</p>}
          </div>
        </div>
        {entitlement.status === "past_due" && <p className="rounded-xl bg-warning/15 px-3 py-2 text-sm">{p.pastDue}</p>}
        {entitlement.hasCustomer && <p className="text-sm text-muted-foreground">{p.manageHint}</p>}
        <div className="flex flex-wrap gap-2">
          {entitlement.hasCustomer && (
            <form action={openBillingPortalAction}>
              <Button type="submit" variant="outline">
                <CreditCard /> {p.manage}
              </Button>
            </form>
          )}
          <Button asChild variant={tier ? "ghost" : "default"}>
            <Link href="/premium">{tier ? p.seePlans : p.upgrade}</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

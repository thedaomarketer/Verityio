import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getI18n } from "@/lib/i18n/server";
import { getPricingCatalog } from "@/lib/data/pricing";
import { isBillingConfigured } from "@/lib/billing/stripe";
import { PricingTable } from "@/components/pricing/pricing-table";
import { PricingDetails } from "@/components/pricing/pricing-details";
import { SiteFooter, SiteHeader } from "@/components/landing/site-chrome";

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await getI18n();
  return { title: `${m.premium.title} · Verityio`, description: m.premium.tagline };
}

/** Public pricing: every price visible before signing up. Signed-in visitors get the in-app page, which can check out. */
export default async function PricingPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims) redirect("/premium");

  const { intl, m } = await getI18n();
  const catalog = getPricingCatalog(intl);
  return (
    <div className="relative flex min-h-svh flex-col overflow-x-clip">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] bg-[radial-gradient(60%_50%_at_20%_0%,rgb(0_113_227/0.14),transparent),radial-gradient(50%_45%_at_85%_10%,rgb(137_68_171/0.12),transparent)]"
      />
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 space-y-10 px-4 pt-10 pb-20 sm:px-6 md:pt-16">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-[32px] leading-tight font-bold tracking-tight sm:text-5xl">{m.premium.title}</h1>
          <p className="mt-3 text-[17px] text-muted-foreground">{m.premium.tagline}</p>
        </div>
        <PricingTable
          mode="public"
          billingEnabled={isBillingConfigured()}
          subscribedTier={null}
          trialEligible
          {...catalog}
        />
        <PricingDetails featureLive={catalog.featureLive} />
      </main>
      <SiteFooter />
    </div>
  );
}

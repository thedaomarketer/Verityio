import Link from "next/link";
import { Crown } from "lucide-react";

import { getI18n } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n/config";
import { FEATURE_TIER, type PaidFeature } from "@/lib/billing/plans";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Shown in place of a paid feature for people whose plan doesn't include it. */
export async function PremiumUpsell({ feature, className }: { feature: PaidFeature; className?: string }) {
  const { m } = await getI18n();
  const info = m.premium.features[feature];
  return (
    <section
      className={cn(
        "flex flex-col items-center gap-3 rounded-3xl border border-black/[0.04] bg-card px-6 py-8 text-center shadow-[0_1px_2px_rgb(16_24_40/0.04),0_8px_24px_-12px_rgb(16_24_40/0.08)]",
        className
      )}
    >
      <span className="flex size-12 items-center justify-center rounded-2xl bg-[linear-gradient(150deg,#ffd36b_0%,#f5a623_55%,#d97a00_100%)] text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.4),0_6px_16px_-4px_rgb(217_122_0/0.5)]">
        <Crown className="size-6" aria-hidden="true" />
      </span>
      <h2 className="text-lg font-bold tracking-tight">{fmt(m.premium.upsellTitle, { feature: info.title, plan: m.premium.tiers[FEATURE_TIER[feature]].name })}</h2>
      <p className="max-w-sm text-sm text-muted-foreground">{info.body}</p>
      <Button asChild size="lg" className="mt-1">
        <Link href="/premium">{m.premium.seePlans}</Link>
      </Button>
    </section>
  );
}

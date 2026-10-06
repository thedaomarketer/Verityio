import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/data/context";
import { getOrCreateUserSettings } from "@/lib/data/settings";
import { getHolidayLookup } from "@/lib/data/holidays";
import { localDateString } from "@/lib/calculations";
import { getI18n } from "@/lib/i18n/server";
import { getAnnualIncomeEstimate, getPayPeriodStatements, getUpcomingPaydays } from "@/lib/data/tax";
import type { JurisdictionSelection } from "@/lib/calculations/tax";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TaxSettingsForm } from "@/components/taxes/tax-settings-form";
import { PaydayCard } from "@/components/taxes/payday-card";
import { PayStatementCard } from "@/components/taxes/pay-statement-card";
import { TaxBreakdownCard } from "@/components/taxes/tax-breakdown-card";
import { AmountsToggle } from "@/components/privacy/amounts-visibility";

export default async function TaxesPage() {
  const [ctx, { m }] = await Promise.all([requireUserContext(), getI18n()]);
  if (!ctx) redirect("/login");

  const supabase = await createClient();
  const [settings, incomeEstimate, paydays, statements] = await Promise.all([
    getOrCreateUserSettings(supabase, ctx.userId),
    getAnnualIncomeEstimate(ctx.userId, ctx.timezone, ctx.weekStartsOn),
    getUpcomingPaydays(ctx.userId, ctx.timezone),
    getPayPeriodStatements(ctx.userId, ctx.timezone, ctx.weekStartsOn),
  ]);

  if (!settings) throw new Error("Could not load tax settings.");

  const paydayYears = paydays.map((p) => Number(localDateString(p.nextPayday, ctx.timezone).slice(0, 4)));
  const paydayHolidays = paydayYears.length > 0 ? await getHolidayLookup(supabase, ctx.userId, paydayYears) : new Map();

  const jurisdiction: JurisdictionSelection | null =
    settings.tax_country && settings.tax_region
      ? { country: settings.tax_country, region: settings.tax_region, city: settings.tax_city ?? undefined }
      : null;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[28px] leading-tight font-bold tracking-tight md:text-3xl">{m.taxes.title}</h1>
          <p className="text-sm text-muted-foreground">{m.taxes.subtitle}</p>
        </div>
        {/* Hides every pay and tax amount on this page (and everywhere else balances are masked). */}
        <AmountsToggle className="-mr-2 shrink-0" />
      </div>

      <PaydayCard paydays={paydays} timezone={ctx.timezone} holidays={paydayHolidays} />

      <PayStatementCard statements={statements} jurisdiction={jurisdiction} timezone={ctx.timezone} currency={ctx.currency} />

      <TaxSettingsForm settings={settings} />

      {jurisdiction ? (
        <TaxBreakdownCard
          jurisdiction={jurisdiction}
          estimatedAnnualIncomeCents={incomeEstimate.annualEstimateCents}
          hasIncomeData={incomeEstimate.hasData}
          currency={ctx.currency}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{m.taxes.withholdingTitle}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{m.taxes.setJurisdictionAbove}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

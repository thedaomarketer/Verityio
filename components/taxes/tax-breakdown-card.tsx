"use client";

import { useMemo, useState } from "react";
import { Receipt } from "lucide-react";

import { estimateTax, type JurisdictionSelection, type TaxLine } from "@/lib/calculations/tax";
import { centsToDollars, dollarsToCents, formatCents } from "@/lib/calculations/money";
import { fmt } from "@/lib/i18n/config";
import { useI18n } from "@/lib/i18n/client";
import type { Messages } from "@/lib/i18n/messages/en";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Amount, useAmountsHidden } from "@/components/privacy/amounts-visibility";

export function TaxBreakdownCard({
  jurisdiction,
  estimatedAnnualIncomeCents,
  hasIncomeData,
  currency,
}: {
  jurisdiction: JurisdictionSelection;
  estimatedAnnualIncomeCents: number;
  hasIncomeData: boolean;
  currency: string;
}) {
  const { intl, m } = useI18n();
  const money = (cents: number) => formatCents(cents, currency, intl);
  const amountsHidden = useAmountsHidden();
  const [annualIncomeDollars, setAnnualIncomeDollars] = useState(() =>
    centsToDollars(estimatedAnnualIncomeCents).toFixed(0)
  );

  const result = useMemo(() => {
    const cents = Math.max(0, dollarsToCents(Number(annualIncomeDollars) || 0));
    return estimateTax(cents, jurisdiction);
  }, [annualIncomeDollars, jurisdiction]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Receipt className="size-4" /> {m.taxes.withholdingTitle}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="annualIncome">{m.taxes.annualIncome}</Label>
          <Input
            id="annualIncome"
            // Masked like a password while balances are hidden; still editable.
            type={amountsHidden ? "password" : "number"}
            inputMode="numeric"
            autoComplete="off"
            min={0}
            step="1"
            value={annualIncomeDollars}
            onChange={(e) => setAnnualIncomeDollars(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            {hasIncomeData ? m.taxes.prefilled : m.taxes.notEnoughHistory}
          </p>
        </div>

        <Separator />

        <div className="space-y-1.5 text-sm">
          {[...result.incomeTaxLines, ...result.payrollDeductionLines].map((line) => (
            <div key={line.kind} className="flex justify-between">
              <span className="text-muted-foreground">{taxLineLabel(line, m)}</span>
              <Amount value={money(line.amountCents)} />
            </div>
          ))}
        </div>

        <Separator />

        <div className="space-y-1.5">
          <div className="flex justify-between text-sm font-medium">
            <span>{m.taxes.totalDeductions}</span>
            <Amount value={money(result.totalDeductionsCents)} />
          </div>
          <div className="flex justify-between text-sm font-medium">
            <span>{m.taxes.netIncome}</span>
            <Amount value={money(result.netAnnualIncomeCents)} />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{m.taxes.effectiveRate}</span>
            <span>
              {result.effectiveRate.toLocaleString(intl, {
                style: "percent",
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
              })}
            </span>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">{fmt(m.taxes.disclaimer, { year: result.taxYear })}</p>
      </CardContent>
    </Card>
  );
}

function taxLineLabel(line: TaxLine, m: Messages): string {
  return fmt(m.taxes.lines[line.kind], { region: line.place ?? "" });
}

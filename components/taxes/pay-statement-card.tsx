import { FileText } from "lucide-react";

import type { PayPeriodStatement, PeriodFigures } from "@/lib/data/tax";
import type { JurisdictionSelection } from "@/lib/calculations/tax";
import { estimateTaxForPeriod } from "@/lib/calculations/tax";
import { formatCents } from "@/lib/calculations/money";
import { formatMinutesAsHours, formatShortDate } from "@/lib/format";
import { fmt } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export async function PayStatementCard({
  statements,
  jurisdiction,
  timezone,
  currency,
}: {
  statements: PayPeriodStatement[];
  jurisdiction: JurisdictionSelection | null;
  timezone: string;
  currency: string;
}) {
  const { m } = await getI18n();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="size-4" /> {m.taxes.currentPayPeriod}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {statements.length === 0 ? (
          <p className="text-sm text-muted-foreground">{m.taxes.noStatements}</p>
        ) : (
          <div className="space-y-6">
            {statements.map((statement, i) => (
              <div key={statement.jobId}>
                {i > 0 && <Separator className="mb-6" />}
                <div className="mb-3 flex min-w-0 items-center gap-2">
                  <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: statement.color }} />
                  <span className="truncate text-sm font-medium">{statement.jobName}</span>
                </div>
                <PeriodBlock
                  title={m.taxes.nextPaycheque}
                  figures={statement.paycheque}
                  estimateFor={jurisdiction ? { jurisdiction, periodsPerYear: statement.periodsPerYear } : null}
                  timezone={timezone}
                  currency={currency}
                />
                {statement.current && (
                  <div className="mt-4 rounded-2xl bg-secondary/60 p-3">
                    <PeriodBlock
                      title={m.taxes.thisPeriod}
                      figures={statement.current}
                      estimateFor={null}
                      soFar
                      timezone={timezone}
                      currency={currency}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

async function PeriodBlock({
  title,
  figures,
  estimateFor,
  soFar = false,
  timezone,
  currency,
}: {
  title: string;
  figures: PeriodFigures;
  /** Show estimated deductions and net pay (the next paycheque only). */
  estimateFor: { jurisdiction: JurisdictionSelection; periodsPerYear: number } | null;
  /** The period is still being worked: label the figures "so far" and skip the net estimate. */
  soFar?: boolean;
  timezone: string;
  currency: string;
}) {
  const { locale, intl, m } = await getI18n();
  const date = (value: Date) => formatShortDate(value, timezone, intl);
  const money = (cents: number) => formatCents(cents, currency, intl);
  const isEmpty = figures.start.getTime() === figures.end.getTime();
  const estimate = estimateFor && !isEmpty
    ? estimateTaxForPeriod(figures.grossEarningsCents, estimateFor.periodsPerYear, estimateFor.jurisdiction)
    : null;
  const suffix = soFar ? ` (${m.taxes.soFar})` : "";

  return (
    <div className="space-y-1.5 text-sm">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-semibold">{title}</span>
        <span className="shrink-0 text-xs text-muted-foreground">{fmt(m.taxes.paidOn, { date: date(figures.payDate) })}</span>
      </div>
      {isEmpty ? (
        <p className="text-muted-foreground">{m.taxes.notStarted}</p>
      ) : (
        <>
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">{m.taxes.periodLabel}</span>
            {/* end is exclusive (midnight after the last day): show the last day worked. */}
            <span>{`${date(figures.start)} – ${date(new Date(figures.end.getTime() - 1))}`}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{m.taxes.hoursWorked}{suffix}</span>
            <span>{formatMinutesAsHours(figures.paidMinutes, locale)}</span>
          </div>
          {figures.overtimeMinutes > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">{m.common.overtime}</span>
              <span>{formatMinutesAsHours(figures.overtimeMinutes, locale)}</span>
            </div>
          )}
          {figures.doubleTimeMinutes > 0 && (
            <div className="flex justify-between pl-3 text-xs">
              <span className="text-muted-foreground">{m.taxes.ofWhichDoubleTime}</span>
              <span>{formatMinutesAsHours(figures.doubleTimeMinutes, locale)}</span>
            </div>
          )}
          <div className="flex justify-between font-medium">
            <span>{m.taxes.grossPay}{suffix}</span>
            <span>{money(figures.grossEarningsCents)}</span>
          </div>
          {estimate ? (
            <>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{m.taxes.estDeductions}</span>
                <span>−{money(estimate.periodDeductionsCents)}</span>
              </div>
              <div className="flex justify-between font-medium">
                <span>{m.taxes.estNetPay}</span>
                <span>{money(estimate.periodNetCents)}</span>
              </div>
            </>
          ) : (
            !soFar && <p className="pt-1 text-xs text-muted-foreground">{m.taxes.setJurisdictionForNet}</p>
          )}
        </>
      )}
    </div>
  );
}

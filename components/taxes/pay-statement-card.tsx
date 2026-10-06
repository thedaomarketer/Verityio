import { FileText } from "lucide-react";

import type { PayPeriodStatement } from "@/lib/data/tax";
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
  const { locale, intl, m } = await getI18n();
  const periodDate = (date: Date) => formatShortDate(date, timezone, intl);
  const money = (cents: number) => formatCents(cents, currency, intl);
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
            {statements.map((statement, i) => {
              const isEmpty = statement.periodStart.getTime() === statement.periodEnd.getTime();
              const estimate = jurisdiction
                ? estimateTaxForPeriod(statement.grossEarningsCents, statement.periodsPerYear, jurisdiction)
                : null;

              return (
                <div key={statement.jobId}>
                  {i > 0 && <Separator className="mb-6" />}
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: statement.color }} />
                      <span className="truncate text-sm font-medium">{statement.jobName}</span>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {isEmpty
                        ? fmt(m.taxes.starts, { date: periodDate(statement.periodStart) })
                        : // periodEnd is exclusive (it's payday's midnight): show the last day worked.
                          `${periodDate(statement.periodStart)} – ${periodDate(new Date(statement.periodEnd.getTime() - 1))}`}
                    </span>
                  </div>

                  {isEmpty ? (
                    <p className="text-sm text-muted-foreground">{m.taxes.notStarted}</p>
                  ) : (
                    <div className="space-y-1.5 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{m.taxes.payday}</span>
                        <span>{periodDate(statement.payDate)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{m.taxes.hoursWorked}</span>
                        <span>{formatMinutesAsHours(statement.paidMinutes, locale)}</span>
                      </div>
                      {statement.overtimeMinutes > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">{m.common.overtime}</span>
                          <span>{formatMinutesAsHours(statement.overtimeMinutes, locale)}</span>
                        </div>
                      )}
                      {statement.doubleTimeMinutes > 0 && (
                        <div className="flex justify-between pl-3 text-xs">
                          <span className="text-muted-foreground">{m.taxes.ofWhichDoubleTime}</span>
                          <span>{formatMinutesAsHours(statement.doubleTimeMinutes, locale)}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-medium">
                        <span>{m.taxes.grossPay}</span>
                        <span>{money(statement.grossEarningsCents)}</span>
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
                        <p className="pt-1 text-xs text-muted-foreground">
                          {m.taxes.setJurisdictionForNet}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

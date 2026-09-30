import { CalendarClock, Flag } from "lucide-react";

import type { JobPayday } from "@/lib/data/tax";
import { holidayDisplayName, localDateString, type PublicHoliday } from "@/lib/calculations";
import { daysUntil, formatDaysAway, formatLongDate } from "@/lib/format";
import { fmt } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export async function PaydayCard({
  paydays,
  timezone,
  holidays,
}: {
  paydays: JobPayday[];
  timezone: string;
  /** The user's regional public holidays by yyyy-mm-dd, to flag paydays that land on one. */
  holidays: Map<string, PublicHoliday>;
}) {
  const { locale, intl, m } = await getI18n();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarClock className="size-4" /> {m.taxes.upcomingPaydays}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {paydays.length === 0 ? (
          <p className="text-sm text-muted-foreground">{m.taxes.noPaydays}</p>
        ) : (
          <ul className="space-y-3">
            {paydays.map((payday) => {
              const holiday = holidays.get(localDateString(payday.nextPayday, timezone));
              return (
                <li key={payday.jobId} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: payday.color }} />
                      <span className="truncate text-sm font-medium">{payday.jobName}</span>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-medium">{formatLongDate(payday.nextPayday, timezone, intl)}</p>
                      <p className="text-xs text-muted-foreground">{formatDaysAway(daysUntil(payday.nextPayday), m)}</p>
                    </div>
                  </div>
                  {holiday && (
                    <p className="flex items-start gap-1.5 rounded-lg bg-muted px-2.5 py-1.5 text-xs text-muted-foreground">
                      <Flag className="mt-0.5 size-3 shrink-0 text-success" aria-hidden="true" />
                      {fmt(m.holidays.paydayOnHoliday, { holiday: holidayDisplayName(holiday, locale) })}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

import { CalendarClock, Flag } from "lucide-react";

import { holidayDisplayName, type PublicHoliday } from "@/lib/calculations/holidays";
import { formatCalendarDate, formatDate, formatTime } from "@/lib/format";
import { getI18n } from "@/lib/i18n/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface UpcomingShift {
  id: string;
  scheduled_start: string | null;
  scheduled_end: string | null;
  job: { name: string; color: string } | null;
}

export async function UpcomingShifts({
  shifts,
  holidays,
  timezone,
}: {
  shifts: UpcomingShift[];
  /** Public holidays in the next few weeks, for the user's region. */
  holidays: PublicHoliday[];
  timezone: string;
}) {
  const { locale, intl, m } = await getI18n();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{m.dashboard.upcoming}</CardTitle>
      </CardHeader>
      <CardContent>
        {shifts.length === 0 && holidays.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{m.dashboard.noUpcoming}</p>
        ) : (
          <ul className="space-y-3">
            {holidays.map((holiday) => (
              <li key={`holiday-${holiday.date}`} className="flex items-center gap-3 text-sm">
                <Flag className="size-4 shrink-0 text-success" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{holidayDisplayName(holiday, locale)}</p>
                  <p className="text-xs text-muted-foreground">
                    {m.holidays.holiday} · {formatCalendarDate(holiday.date, intl)}
                  </p>
                </div>
              </li>
            ))}
            {shifts.map((shift) => (
              <li key={shift.id} className="flex items-center gap-3 text-sm">
                <CalendarClock className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{shift.job?.name ?? m.dashboard.shift}</p>
                  {shift.scheduled_start && (
                    <p className="text-xs text-muted-foreground">
                      {formatDate(shift.scheduled_start, timezone, intl)} · {formatTime(shift.scheduled_start, timezone, intl)}
                      {shift.scheduled_end ? ` – ${formatTime(shift.scheduled_end, timezone, intl)}` : ""}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

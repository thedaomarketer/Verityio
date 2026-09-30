import { calculateShiftDuration, holidayDisplayName, localDateString } from "@/lib/calculations";
import { getHolidayLookup } from "@/lib/data/holidays";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatMinutesAsHours, formatTime } from "@/lib/format";
import { getI18n } from "@/lib/i18n/server";
import type { Messages } from "@/lib/i18n/messages/en";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EditShiftDialog } from "./edit-shift-dialog";
import { DeleteShiftButton } from "./delete-shift-button";

interface BreakRow {
  started_at: string;
  ended_at: string | null;
  is_paid: boolean;
}

export interface ShiftHistoryRow {
  id: string;
  actual_start: string | null;
  actual_end: string | null;
  status: string;
  notes: string | null;
  breaks: BreakRow[];
  job: { id: string; name: string; color: string } | null;
}

export async function ShiftHistoryTable({
  shifts,
  jobs,
  timezone,
  userId,
}: {
  /** Owner of the shifts, for looking up their region's public holidays. */
  userId: string;
  shifts: ShiftHistoryRow[];
  jobs: { id: string; name: string }[];
  timezone: string;
}) {
  const { locale, intl, m } = await getI18n();

  // Flag shifts that started on a public holiday (local date, user's zone).
  const localDates = shifts.filter((s) => s.actual_start).map((s) => localDateString(s.actual_start!, timezone));
  const years = [...new Set(localDates.map((d) => Number(d.slice(0, 4))))];
  const holidays = years.length > 0 ? await getHolidayLookup(await createClient(), userId, years) : new Map();

  if (shifts.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">{m.time.noShifts}</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{m.common.date}</TableHead>
          <TableHead>{m.common.job}</TableHead>
          <TableHead>{m.time.title}</TableHead>
          <TableHead>{m.time.paid}</TableHead>
          <TableHead>{m.common.status}</TableHead>
          <TableHead className="text-right">{m.common.actions}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {shifts.map((shift) => {
          if (!shift.actual_start) return null;
          const result = calculateShiftDuration({
            start: shift.actual_start,
            end: shift.actual_end,
            breaks: shift.breaks.map((b) => ({ startedAt: b.started_at, endedAt: b.ended_at, isPaid: b.is_paid })),
          });

          const holiday = holidays.get(localDateString(shift.actual_start, timezone));

          return (
            <TableRow key={shift.id}>
              <TableCell>
                <span className="whitespace-nowrap">{formatDate(shift.actual_start, timezone, intl)}</span>
                {holiday && (
                  <Badge variant="success" className="ml-1.5" title={holidayDisplayName(holiday, locale)}>
                    {m.holidays.holiday}
                  </Badge>
                )}
              </TableCell>
              <TableCell>
                {shift.job && (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-2 rounded-full" style={{ backgroundColor: shift.job.color }} />
                    {shift.job.name}
                  </span>
                )}
              </TableCell>
              <TableCell className="tabular-nums">
                {formatTime(shift.actual_start, timezone, intl)}
                {shift.actual_end ? ` – ${formatTime(shift.actual_end, timezone, intl)}` : ` – ${m.time.ongoing}`}
              </TableCell>
              <TableCell className="tabular-nums">
                {result.isComplete ? formatMinutesAsHours(result.paidMinutes, locale) : "—"}
              </TableCell>
              <TableCell>
                <Badge variant={shift.status === "active" ? "success" : "outline"}>
                  {shiftStatusLabel(shift.status, m)}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                {shift.status !== "active" && shift.actual_end && (
                  <div className="flex justify-end gap-1">
                    <EditShiftDialog
                      shiftId={shift.id}
                      jobs={jobs}
                      timezone={timezone}
                      defaultValues={{
                        jobId: shift.job?.id ?? "",
                        actualStart: shift.actual_start,
                        actualEnd: shift.actual_end,
                        notes: shift.notes,
                      }}
                    />
                    <DeleteShiftButton shiftId={shift.id} />
                  </div>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function shiftStatusLabel(status: string, m: Messages): string {
  return m.time.status[status as keyof Messages["time"]["status"]] ?? status;
}

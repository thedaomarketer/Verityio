import Papa from "papaparse";
import { formatInTimeZone } from "date-fns-tz";
import { APP_SLUG } from "@/lib/brand";
import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/data/context";
import { hasFeature } from "@/lib/data/subscription";
import { addDaysToDateString, calculateShiftDuration, isDateString, localDateString, localDayStart } from "@/lib/calculations";
import { getI18n } from "@/lib/i18n/server";

/** ISO 8601 with the user's own offset, e.g. "2024-06-10T22:00:00-04:00" -- local wall-clock, still unambiguous. */
function localIso(instant: string, timezone: string): string {
  return formatInTimeZone(instant, timezone, "yyyy-MM-dd'T'HH:mm:ssXXX");
}

export async function GET(request: NextRequest) {
  const [ctx, { m }] = await Promise.all([requireUserContext(), getI18n()]);
  if (!ctx) return NextResponse.json({ error: m.errors.mustSignIn }, { status: 401 });
  if (!(await hasFeature(ctx.userId, "reports"))) {
    return NextResponse.json({ error: m.errors.premiumRequired }, { status: 403 });
  }

  const supabase = await createClient();
  const { searchParams } = request.nextUrl;
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  let query = supabase
    .from("shifts")
    .select("*, breaks(*), job:jobs(name)")
    .eq("user_id", ctx.userId)
    .eq("status", "completed")
    .order("actual_start", { ascending: true });

  // Inclusive local calendar dates, matched in the user's time zone (same as the Reports page).
  if (start && isDateString(start)) {
    query = query.gte("actual_start", localDayStart(start, ctx.timezone).toISOString());
  }
  if (end && isDateString(end)) {
    query = query.lt("actual_start", localDayStart(addDaysToDateString(end, 1), ctx.timezone).toISOString());
  }

  const { data: shifts } = await query;
  const c = m.csv;

  const rows = (shifts ?? [])
    .filter((shift) => shift.actual_start)
    .map((shift) => {
      const result = calculateShiftDuration({
        start: shift.actual_start!,
        end: shift.actual_end,
        breaks: shift.breaks.map((b) => ({ startedAt: b.started_at, endedAt: b.ended_at, isPaid: b.is_paid })),
      });
      return {
        [c.date]: localDateString(shift.actual_start!, ctx.timezone),
        [c.job]: shift.job?.name ?? "",
        [c.start]: localIso(shift.actual_start!, ctx.timezone),
        [c.end]: shift.actual_end ? localIso(shift.actual_end, ctx.timezone) : "",
        [c.grossMinutes]: result.grossMinutes,
        [c.unpaidBreakMinutes]: result.unpaidBreakMinutes,
        [c.paidMinutes]: result.paidMinutes,
        [c.notes]: shift.notes ?? "",
      };
    });

  // Explicit columns so an empty export still has a header row.
  const csv = Papa.unparse(rows, {
    columns: [c.date, c.job, c.start, c.end, c.grossMinutes, c.unpaidBreakMinutes, c.paidMinutes, c.notes],
  });

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${APP_SLUG}-hours.csv"`,
    },
  });
}

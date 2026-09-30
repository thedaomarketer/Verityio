import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/data/context";
import { getI18n } from "@/lib/i18n/server";
import { getActiveShift, getRecentShiftHistory } from "@/lib/data/shifts";
import { ActiveShiftCard } from "@/components/time/active-shift-card";
import { ClockInCard } from "@/components/time/clock-in-card";
import { ManualShiftDialog } from "@/components/time/manual-shift-dialog";
import { ShiftHistoryTable } from "@/components/time/shift-history-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function TimePage() {
  const [ctx, { m }] = await Promise.all([requireUserContext(), getI18n()]);
  if (!ctx) redirect("/login");

  const supabase = await createClient();
  const [{ data: jobs }, activeShift, recentShifts] = await Promise.all([
    supabase
      .from("jobs")
      .select("id, name, color")
      .eq("user_id", ctx.userId)
      .eq("is_active", true)
      .order("name"),
    getActiveShift(ctx.userId),
    getRecentShiftHistory(ctx.userId),
  ]);

  const jobOptions = jobs ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-[28px] leading-tight font-bold tracking-tight md:text-3xl">{m.time.title}</h1>
        <ManualShiftDialog jobs={jobOptions} timezone={ctx.timezone} />
      </div>

      {activeShift ? (
        <ActiveShiftCard
          shift={{
            id: activeShift.id,
            actual_start: activeShift.actual_start!,
            job: activeShift.job,
            breaks: activeShift.breaks,
          }}
          timezone={ctx.timezone}
        />
      ) : (
        <ClockInCard jobs={jobOptions} />
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{m.time.shiftHistory}</CardTitle>
        </CardHeader>
        <CardContent className="px-0 sm:px-6">
          <ShiftHistoryTable shifts={recentShifts} jobs={jobOptions} timezone={ctx.timezone} />
        </CardContent>
      </Card>
    </div>
  );
}

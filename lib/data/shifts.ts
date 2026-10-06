import "server-only";

import { createClient } from "@/lib/supabase/server";

export async function getActiveShift(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("shifts")
    .select("*, breaks(*), job:jobs(id, name, color, hourly_rate)")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  return data;
}

export async function getCompletedShiftsInRange(userId: string, start: Date, end: Date) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("shifts")
    .select("*, breaks(*), job:jobs(id, name, color, hourly_rate, overtime_rate, overtime_threshold_minutes, daily_overtime_threshold_minutes, double_time_threshold_minutes, double_time_rate)")
    .eq("user_id", userId)
    .eq("status", "completed")
    .gte("actual_start", start.toISOString())
    .lt("actual_start", end.toISOString())
    .order("actual_start", { ascending: false });
  return data ?? [];
}

export async function getUpcomingShifts(userId: string, limit = 5) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("shifts")
    .select("*, job:jobs(id, name, color)")
    .eq("user_id", userId)
    .in("status", ["scheduled"])
    .gte("scheduled_start", new Date().toISOString())
    .order("scheduled_start", { ascending: true })
    .limit(limit);
  return data ?? [];
}

export async function getRecentShiftHistory(userId: string, limit = 25) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("shifts")
    .select("*, breaks(*), job:jobs(id, name, color, hourly_rate, overtime_rate, overtime_threshold_minutes, daily_overtime_threshold_minutes, double_time_threshold_minutes, double_time_rate)")
    .eq("user_id", userId)
    .not("actual_start", "is", null)
    .order("actual_start", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function getShiftById(userId: string, shiftId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("shifts")
    .select("*, breaks(*), job:jobs(id, name, color, hourly_rate, overtime_rate, overtime_threshold_minutes, daily_overtime_threshold_minutes, double_time_threshold_minutes, double_time_rate)")
    .eq("user_id", userId)
    .eq("id", shiftId)
    .maybeSingle();
  return data;
}

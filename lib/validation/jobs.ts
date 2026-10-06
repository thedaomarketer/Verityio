import { z } from "zod";

import { v } from "@/lib/i18n/validation";

export const jobSchema = z.object({
  name: z.string().trim().min(1, v("jobNameRequired")).max(200),
  companyName: z.string().trim().max(200).optional().or(z.literal("")),
  jobTitle: z.string().trim().max(200).optional().or(z.literal("")),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  hourlyRate: z.coerce.number().min(0).max(100000).optional(),
  overtimeRate: z.coerce.number().min(0).max(100000).optional(),
  overtimeThresholdHours: z.coerce.number().min(0).max(168).optional(),
  dailyOvertimeHours: z.coerce.number().min(0).max(24).optional(),
  doubleTimeHours: z.coerce.number().min(0).max(24).optional(),
  doubleTimeRate: z.coerce.number().min(0).max(100000).optional(),
  startDate: z.string().optional().or(z.literal("")),
  endDate: z.string().optional().or(z.literal("")),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, v("colorInvalid")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  payFrequency: z.enum(["weekly", "biweekly", "semi_monthly", "monthly"]).optional().or(z.literal("")),
  payAnchorDate: z.string().optional().or(z.literal("")),
}).refine(
  (job) => !job.dailyOvertimeHours || !job.doubleTimeHours || job.doubleTimeHours > job.dailyOvertimeHours,
  { message: v("doubleTimeAfterDaily"), path: ["doubleTimeHours"] }
);

/** Hours (possibly fractional, e.g. 7.5) -> whole minutes; 0 or empty means "no threshold". */
export function hoursToThresholdMinutes(hours: number | undefined): number | null {
  return hours != null && hours > 0 ? Math.round(hours * 60) : null;
}

export type JobInput = z.infer<typeof jobSchema>;

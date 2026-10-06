"use client";

import { useId } from "react";

import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/config";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { OvertimeRulesFields } from "./overtime-rules-fields";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PAY_FREQUENCIES = ["weekly", "biweekly", "semi_monthly", "monthly"] as const;

const PRESET_COLORS = [
  "#2563eb",
  "#dc2626",
  "#16a34a",
  "#d97706",
  "#7c3aed",
  "#db2777",
  "#0891b2",
  "#525252",
];

export function JobFormFields({
  defaultValues,
}: {
  defaultValues?: {
    name?: string;
    companyName?: string | null;
    jobTitle?: string | null;
    description?: string | null;
    hourlyRate?: number | null;
    overtimeRate?: number | null;
    overtimeThresholdMinutes?: number | null;
    dailyOvertimeThresholdMinutes?: number | null;
    doubleTimeThresholdMinutes?: number | null;
    doubleTimeRate?: number | null;
    startDate?: string | null;
    endDate?: string | null;
    color?: string;
    notes?: string | null;
    payFrequency?: string | null;
    payAnchorDate?: string | null;
  };
}) {
  const id = useId();
  const { m } = useI18n();
  const f = m.jobs.form;
  const dv = defaultValues ?? {};

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${id}-name`}>{f.name}</Label>
          <Input id={`${id}-name`} name="name" defaultValue={dv.name} placeholder={f.namePlaceholder} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${id}-jobTitle`}>{f.jobTitle}</Label>
          <Input id={`${id}-jobTitle`} name="jobTitle" defaultValue={dv.jobTitle ?? ""} placeholder={f.jobTitlePlaceholder} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${id}-companyName`}>{f.company}</Label>
        <Input id={`${id}-companyName`} name="companyName" defaultValue={dv.companyName ?? ""} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${id}-hourlyRate`}>{f.hourlyRate}</Label>
          <Input
            id={`${id}-hourlyRate`}
            name="hourlyRate"
            type="number"
            min={0}
            step="0.01"
            defaultValue={dv.hourlyRate ?? ""}
            placeholder="24.00"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${id}-overtimeRate`}>{f.overtimeRate}</Label>
          <Input
            id={`${id}-overtimeRate`}
            name="overtimeRate"
            type="number"
            min={0}
            step="0.01"
            defaultValue={dv.overtimeRate ?? ""}
            placeholder="36.00"
          />
        </div>
      </div>
      <OvertimeRulesFields
        weeklyMinutes={dv.overtimeThresholdMinutes}
        dailyMinutes={dv.dailyOvertimeThresholdMinutes}
        doubleTimeMinutes={dv.doubleTimeThresholdMinutes}
        doubleTimeRate={dv.doubleTimeRate}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${id}-startDate`}>{f.startDate}</Label>
          <Input id={`${id}-startDate`} name="startDate" type="date" defaultValue={dv.startDate ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${id}-endDate`}>{f.endDate}</Label>
          <Input id={`${id}-endDate`} name="endDate" type="date" defaultValue={dv.endDate ?? ""} />
        </div>
      </div>
      <div className="space-y-2">
        <p id={`${id}-color`} className="text-sm leading-none font-medium">
          {f.color}
        </p>
        <div role="radiogroup" aria-labelledby={`${id}-color`} className="flex flex-wrap items-center gap-2">
          {PRESET_COLORS.map((color, i) => (
            <label key={color} className="cursor-pointer">
              <input
                type="radio"
                name="color"
                value={color}
                defaultChecked={(dv.color ?? PRESET_COLORS[0]) === color}
                aria-label={fmt(f.colorOption, { n: i + 1 })}
                className="peer sr-only"
              />
              <span
                className="block size-7 rounded-full ring-offset-2 ring-offset-background peer-checked:ring-2 peer-checked:ring-foreground"
                style={{ backgroundColor: color }}
              />
            </label>
          ))}
        </div>
      </div>
      <div className="space-y-2 rounded-2xl border border-black/[0.06] p-3.5">
        <p className="text-sm font-medium">{f.paySchedule}</p>
        <p className="text-xs text-muted-foreground">
          {f.payScheduleHint}
        </p>
        <div className="grid gap-4 pt-1 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor={`${id}-payFrequency`}>{f.payFrequency}</Label>
            <Select name="payFrequency" defaultValue={dv.payFrequency ?? undefined}>
              <SelectTrigger className="w-full" id={`${id}-payFrequency`}>
                <SelectValue placeholder={m.common.notSet} />
              </SelectTrigger>
              <SelectContent>
                {PAY_FREQUENCIES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {m.jobs.frequency[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${id}-payAnchorDate`}>{f.knownPayDate}</Label>
            <Input
              id={`${id}-payAnchorDate`}
              name="payAnchorDate"
              type="date"
              defaultValue={dv.payAnchorDate ?? ""}
            />
          </div>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${id}-description`}>{m.common.description}</Label>
        <Textarea id={`${id}-description`} name="description" defaultValue={dv.description ?? ""} rows={2} />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${id}-notes`}>{m.common.notes}</Label>
        <Textarea id={`${id}-notes`} name="notes" defaultValue={dv.notes ?? ""} rows={2} />
      </div>
    </div>
  );
}

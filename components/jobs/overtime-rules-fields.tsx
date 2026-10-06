"use client";

import { useId, useState } from "react";

import { OVERTIME_PRESETS, type OvertimePreset } from "@/lib/calculations/range-summary";
import { useI18n } from "@/lib/i18n/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const PRESET_ORDER: OvertimePreset[] = ["weekly40", "weekly44", "california", "britishColumbia", "daily8", "colorado"];

const hours = (minutes: number | null | undefined) => (minutes != null && minutes > 0 ? String(minutes / 60) : "");

/**
 * Weekly overtime, daily overtime and daily double time for a job. A preset
 * fills the three thresholds in one tap (each stays editable); the rates are
 * the job's own. Inputs are named for the job form's server action.
 */
export function OvertimeRulesFields({
  weeklyMinutes,
  dailyMinutes,
  doubleTimeMinutes,
  doubleTimeRate,
}: {
  weeklyMinutes?: number | null;
  dailyMinutes?: number | null;
  doubleTimeMinutes?: number | null;
  doubleTimeRate?: number | null;
}) {
  const id = useId();
  const { m } = useI18n();
  const f = m.jobs.form;
  const [weekly, setWeekly] = useState(hours(weeklyMinutes));
  const [daily, setDaily] = useState(hours(dailyMinutes));
  const [doubleTime, setDoubleTime] = useState(hours(doubleTimeMinutes));

  function applyPreset(preset: OvertimePreset) {
    const rules = OVERTIME_PRESETS[preset];
    setWeekly(hours(rules.weekly));
    setDaily(hours(rules.daily));
    setDoubleTime(hours(rules.doubleTime));
  }

  return (
    <div className="space-y-3 rounded-2xl border border-black/[0.06] p-3.5">
      <div>
        <p className="text-sm font-medium">{f.overtimeRules}</p>
        <p className="text-xs text-muted-foreground">{f.overtimeRulesHint}</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${id}-preset`}>{f.overtimePreset}</Label>
        <Select onValueChange={(value) => applyPreset(value as OvertimePreset)}>
          <SelectTrigger className="w-full" id={`${id}-preset`}>
            <SelectValue placeholder={f.overtimePresetPlaceholder} />
          </SelectTrigger>
          <SelectContent>
            {PRESET_ORDER.map((preset) => (
              <SelectItem key={preset} value={preset}>
                {f.overtimePresets[preset]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor={`${id}-weekly`}>{f.overtimeAfter}</Label>
          <Input
            id={`${id}-weekly`}
            name="overtimeThresholdHours"
            type="number"
            inputMode="decimal"
            min={0}
            max={168}
            step="0.5"
            value={weekly}
            onChange={(event) => setWeekly(event.target.value)}
            placeholder="40"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${id}-daily`}>{f.dailyOvertimeAfter}</Label>
          <Input
            id={`${id}-daily`}
            name="dailyOvertimeHours"
            type="number"
            inputMode="decimal"
            min={0}
            max={24}
            step="0.5"
            value={daily}
            onChange={(event) => setDaily(event.target.value)}
            placeholder={f.none}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${id}-double`}>{f.doubleTimeAfter}</Label>
          <Input
            id={`${id}-double`}
            name="doubleTimeHours"
            type="number"
            inputMode="decimal"
            min={0}
            max={24}
            step="0.5"
            value={doubleTime}
            onChange={(event) => setDoubleTime(event.target.value)}
            placeholder={f.none}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${id}-doubleRate`}>{f.doubleTimeRate}</Label>
        <Input
          id={`${id}-doubleRate`}
          name="doubleTimeRate"
          type="number"
          inputMode="decimal"
          min={0}
          step="0.01"
          defaultValue={doubleTimeRate ?? ""}
          placeholder={f.doubleTimeRatePlaceholder}
        />
      </div>
      <p className="text-xs text-muted-foreground">{f.overtimeHint}</p>
    </div>
  );
}

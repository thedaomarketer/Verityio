"use client";

import { useState } from "react";

import { donutSegments, foldSlices, ringSegmentPath, type Slice } from "@/lib/charts/donut";
import { cn } from "@/lib/utils";
import { makeFormatter, type ValueFormat } from "@/lib/charts/value-format";

const SIZE = 168;
const OUTER = SIZE / 2;
const INNER = OUTER - 22;

/**
 * Part-to-whole at a glance: a donut of at most six segments (the rest fold
 * into "Other") beside a legend that always shows each part's value and
 * percent -- identity never rests on color alone, and no number hides behind
 * hover. Hovering or focusing a segment or legend row puts that part's
 * value in the center; otherwise the center shows the total.
 */
export function DonutChart({
  data,
  format,
  totalLabel,
  otherLabel,
  otherColor = "var(--chart-8)",
  emptyMessage,
}: {
  data: Slice[];
  /** Plain data (not a function), so Server Components can pass it. */
  format: ValueFormat;
  totalLabel: string;
  otherLabel: string;
  /** Color for the folded "Other" slice; pass the same color the data uses for its own "other", if any. */
  otherColor?: string;
  emptyMessage: string;
}) {
  const formatValue = makeFormatter(format);
  const [active, setActive] = useState<string | null>(null);
  const segments = donutSegments(foldSlices(data, { label: otherLabel, color: otherColor }));

  if (segments.length === 0) {
    return <p className="flex h-40 items-center justify-center text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const focused = segments.find((s) => s.key === active) ?? null;

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
      <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width={SIZE} height={SIZE} role="img" aria-hidden="true">
          {segments.map((s) => (
            <path
              key={s.key}
              d={ringSegmentPath(OUTER, OUTER, OUTER - 1, INNER, s.startAngle, s.endAngle)}
              fill={s.color}
              // The 2px surface-colored gap between touching segments.
              stroke="var(--card)"
              strokeWidth={segments.length > 1 ? 2 : 0}
              strokeLinejoin="round"
              className={cn("transition-opacity duration-150", active && active !== s.key && "opacity-35")}
              onPointerEnter={() => setActive(s.key)}
              onPointerLeave={() => setActive(null)}
            />
          ))}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-7 text-center">
          <span className="max-w-full truncate text-xs text-muted-foreground">{focused ? focused.label : totalLabel}</span>
          <span className="text-lg leading-tight font-bold tracking-tight tabular-nums">
            {formatValue(focused ? focused.value : total)}
          </span>
          {focused && <span className="text-xs text-muted-foreground tabular-nums">{focused.percent}%</span>}
        </div>
      </div>

      <ul className="w-full min-w-0 flex-1 space-y-0.5">
        {segments.map((s) => (
          <li key={s.key}>
            <button
              type="button"
              onPointerEnter={() => setActive(s.key)}
              onPointerLeave={() => setActive(null)}
              onFocus={() => setActive(s.key)}
              onBlur={() => setActive(null)}
              className={cn(
                "flex min-h-9 w-full items-center gap-2.5 rounded-lg px-2 text-left text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                active === s.key && "bg-accent/60"
              )}
            >
              <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate text-muted-foreground">{s.label}</span>
              <span className="font-medium tabular-nums">{formatValue(s.value)}</span>
              <span className="w-10 text-right text-xs text-muted-foreground tabular-nums">{s.percent}%</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

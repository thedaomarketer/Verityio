"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

import { areaPath, labelIndexes, linePath, nearestIndex, scalePoints } from "@/lib/charts/line";
import { niceAxisMax } from "@/lib/charts/scale";
import { makeAxisFormatter, makeFormatter, type ValueFormat } from "@/lib/charts/value-format";

export interface LineSeries {
  key: string;
  label: string;
  /** Any CSS color, typically a `var(--chart-n)` token. */
  color: string;
  /** A dashed line for a comparison/reference series (e.g. "last month"). */
  dashed?: boolean;
}

export interface LinePoint {
  /** x label, e.g. "Jun 10". */
  label: string;
  values: Record<string, number>;
}

const HEIGHT = 176;
const TICKS = 4;

/**
 * A line chart for change over time. 2px lines, a 10% area wash when there's
 * a single series, recessive hairline grid, one y-axis. A crosshair snaps to
 * the nearest point on hover (or arrow keys when focused) and a tooltip
 * lists every series there. Selective x labels never collide, and a
 * screen-reader table carries every value.
 */
export function LineChart({
  data,
  series,
  format,
  emptyMessage,
  caption,
}: {
  data: LinePoint[];
  series: LineSeries[];
  /** Plain data (not a function), so Server Components can pass it. */
  format: ValueFormat;
  emptyMessage: string;
  /** Names the chart for the screen-reader table. */
  caption: string;
}) {
  const formatValue = makeFormatter(format);
  const formatAxisTick = makeAxisFormatter(format);
  const plotRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState<number | null>(null);

  const rawMax = Math.max(0, ...data.flatMap((point) => series.map((s) => point.values[s.key] ?? 0)));
  const hasData = data.length > 0 && rawMax > 0;

  useEffect(() => {
    const el = plotRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasData]);

  if (!hasData) {
    return (
      <p className="flex items-center justify-center text-sm text-muted-foreground" style={{ height: HEIGHT }}>
        {emptyMessage}
      </p>
    );
  }

  const { max, step } = niceAxisMax(rawMax, TICKS);
  const ticks = Array.from({ length: Math.round(max / step) + 1 }, (_, i) => step * i);
  const lines = series.map((s) => ({
    ...s,
    points: scalePoints(
      data.map((point) => point.values[s.key] ?? 0),
      width,
      HEIGHT,
      max
    ),
  }));
  const shownLabels = new Set(labelIndexes(data.length));

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    setIndex(nearestIndex(event.clientX - rect.left, data.length, rect.width));
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      const delta = event.key === "ArrowRight" ? 1 : -1;
      setIndex((current) => Math.min(data.length - 1, Math.max(0, (current ?? (delta > 0 ? -1 : data.length)) + delta)));
    }
  }

  const crosshairX = index !== null && lines[0]?.points[index] ? lines[0].points[index].x : null;
  // Keep the tooltip inside the plot: flip it to the left of the crosshair past the midpoint.
  const tooltipOnLeft = crosshairX !== null && crosshairX > width / 2;

  return (
    <div>
      {series.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {series.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5">
              <svg width="14" height="4" aria-hidden="true">
                <line
                  x1="1"
                  y1="2"
                  x2="13"
                  y2="2"
                  stroke={s.color}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeDasharray={s.dashed ? "3 3" : undefined}
                />
              </svg>
              {s.label}
            </span>
          ))}
        </div>
      )}

      <div className="flex gap-3">
        <div
          className="flex w-12 shrink-0 flex-col justify-between text-right text-xs text-muted-foreground tabular-nums"
          style={{ height: HEIGHT }}
          aria-hidden="true"
        >
          {[...ticks].reverse().map((tick) => (
            <span key={tick} className="-my-2 whitespace-nowrap">
              {formatAxisTick(tick)}
            </span>
          ))}
        </div>

        <div
          ref={plotRef}
          tabIndex={0}
          aria-label={caption}
          onPointerMove={onPointerMove}
          onPointerLeave={() => setIndex(null)}
          onFocus={() => setIndex((current) => current ?? data.length - 1)}
          onBlur={() => setIndex(null)}
          onKeyDown={onKeyDown}
          className="relative min-w-0 flex-1 touch-pan-y rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          style={{ height: HEIGHT }}
        >
          {width > 0 && (
            <svg width={width} height={HEIGHT} className="absolute inset-0 overflow-visible" aria-hidden="true">
              {ticks.map((tick) => {
                const y = HEIGHT - (tick / max) * HEIGHT;
                return (
                  <line
                    key={tick}
                    x1={0}
                    x2={width}
                    y1={y}
                    y2={y}
                    stroke={tick === 0 ? "var(--chart-axis)" : "var(--chart-grid)"}
                    strokeWidth={1}
                  />
                );
              })}

              {lines.length === 1 && <path d={areaPath(lines[0].points, HEIGHT)} fill={lines[0].color} opacity={0.1} />}

              {lines.map((line) => (
                <path
                  key={line.key}
                  d={linePath(line.points)}
                  fill="none"
                  stroke={line.color}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray={line.dashed ? "4 4" : undefined}
                />
              ))}

              {crosshairX !== null && (
                <line x1={crosshairX} x2={crosshairX} y1={0} y2={HEIGHT} stroke="var(--chart-axis)" strokeWidth={1} />
              )}

              {index !== null &&
                lines.map((line) => {
                  const p = line.points[index];
                  return p ? (
                    <circle key={line.key} cx={p.x} cy={p.y} r={4.5} fill={line.color} stroke="var(--card)" strokeWidth={2} />
                  ) : null;
                })}

              {/* The endpoint is the one value worth a permanent marker. */}
              {index === null &&
                lines
                  .filter((line) => !line.dashed)
                  .map((line) => {
                    const p = line.points[line.points.length - 1];
                    return p ? (
                      <circle key={line.key} cx={p.x} cy={p.y} r={4} fill={line.color} stroke="var(--card)" strokeWidth={2} />
                    ) : null;
                  })}
            </svg>
          )}

          {index !== null && crosshairX !== null && (
            <div
              className="pointer-events-none absolute top-0 z-10 w-max max-w-[12rem] rounded-lg border bg-popover px-2.5 py-1.5 text-xs shadow-md"
              style={tooltipOnLeft ? { right: width - crosshairX + 10 } : { left: crosshairX + 10 }}
            >
              <p className="text-muted-foreground">{data[index].label}</p>
              {series.map((s) => (
                <p key={s.key} className="flex items-center gap-1.5">
                  <svg width="10" height="4" aria-hidden="true">
                    <line x1="1" y1="2" x2="9" y2="2" stroke={s.color} strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  <span className="font-semibold text-popover-foreground tabular-nums">
                    {formatValue(data[index].values[s.key] ?? 0)}
                  </span>
                  {series.length > 1 && <span className="text-muted-foreground">{s.label}</span>}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-3 pt-1.5" aria-hidden="true">
        <div className="w-12 shrink-0" />
        <div className="relative h-4 min-w-0 flex-1 text-xs text-muted-foreground">
          {data.map((point, i) =>
            shownLabels.has(i) ? (
              <span
                key={`${point.label}-${i}`}
                className="absolute whitespace-nowrap"
                style={
                  i === 0
                    ? { left: 0 }
                    : i === data.length - 1
                      ? { right: 0 }
                      : { left: `${(i / (data.length - 1)) * 100}%`, transform: "translateX(-50%)" }
                }
              >
                {point.label}
              </span>
            ) : null
          )}
        </div>
      </div>

      <table className="sr-only">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col" />
            {series.map((s) => (
              <th key={s.key} scope="col">
                {s.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((point, i) => (
            <tr key={`${point.label}-${i}`}>
              <th scope="row">{point.label}</th>
              {series.map((s) => (
                <td key={s.key}>{formatValue(point.values[s.key] ?? 0)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

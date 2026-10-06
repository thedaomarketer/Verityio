import { niceAxisMax } from "@/lib/charts/scale";

export interface TimeSeriesSeries {
  key: string;
  label: string;
  /** A literal Tailwind class, e.g. "bg-chart-1" -- must exist as a static string somewhere for Tailwind to generate it. */
  colorClassName: string;
}

export interface TimeSeriesPoint {
  /** x-axis tick label, e.g. "Jun 10". */
  label: string;
  /** seriesKey -> value, in the same unit for every series. */
  values: Record<string, number>;
}

const TICK_COUNT = 4;
const PLOT_HEIGHT = 176; // px; the fixed pixel height gridlines and bars both resolve percentages against.
const GAP = 8; // px between columns (gap-2)

/**
 * Narrowest a column may get: room for its bar label at text-[11px]
 * (~6.5px a character) and a two-line date. With more columns than fit, the
 * plot scrolls sideways inside its card -- never the whole page.
 */
function minColumnWidth(labels: string[]): number {
  const longest = Math.max(0, ...labels.map((label) => label.length));
  return Math.max(32, Math.ceil(longest * 6.5) + 6);
}

/**
 * A vertical bar chart over time buckets -- one bar per series, or a
 * stacked bar when multiple series are given. Every value is a direct,
 * always-visible label; hover/focus adds a per-series breakdown, but never
 * gates a number behind it (see the dataviz skill's interaction rules).
 */
export function TimeSeriesBarChart({
  data,
  series,
  formatValue,
  formatAxisTick = formatValue,
  formatBarLabel = formatAxisTick,
  emptyMessage,
}: {
  data: TimeSeriesPoint[];
  series: TimeSeriesSeries[];
  /** Exact values: tooltips and screen-reader labels. */
  formatValue: (value: number) => string;
  /** Round numbers on the axis (e.g. whole dollars). */
  formatAxisTick?: (value: number) => string;
  /** The always-visible label above each bar; defaults to the axis format so it fits a phone. */
  formatBarLabel?: (value: number) => string;
  emptyMessage: string;
}) {
  const totals = data.map((point) => series.reduce((sum, s) => sum + (point.values[s.key] ?? 0), 0));
  const rawMax = Math.max(0, ...totals);

  if (rawMax === 0) {
    return (
      <p className="flex items-center justify-center text-sm text-muted-foreground" style={{ height: PLOT_HEIGHT }}>
        {emptyMessage}
      </p>
    );
  }

  const { max, step } = niceAxisMax(rawMax, TICK_COUNT);
  // Derive ticks from max/step directly (never a fixed TICK_COUNT+1 count):
  // `max` is only guaranteed to be a multiple of `step`, not of `step *
  // TICK_COUNT`, so hard-coding the tick count could stop short of `max`
  // and let a bar visually overshoot the topmost gridline.
  const ticks = Array.from({ length: Math.round(max / step) + 1 }, (_, i) => step * i);
  const barLabels = totals.map((total) => (total > 0 ? formatBarLabel(total) : ""));
  const columnWidth = minColumnWidth(barLabels);
  const plotMinWidth = data.length * columnWidth + (data.length - 1) * GAP;

  return (
    <div>
      {series.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {series.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5">
              <span className={`size-2.5 rounded-full ${s.colorClassName}`} />
              {s.label}
            </span>
          ))}
        </div>
      )}

      <div className="flex gap-3">
        <div
          className="flex min-w-8 shrink-0 flex-col justify-between text-right text-xs text-muted-foreground tabular-nums"
          style={{ height: PLOT_HEIGHT }}
        >
          {[...ticks].reverse().map((tick) => (
            <span key={tick} className="whitespace-nowrap">
              {formatAxisTick(tick)}
            </span>
          ))}
        </div>

        <div className="no-scrollbar min-w-0 flex-1 overflow-x-auto overscroll-x-contain">
          <div style={{ minWidth: plotMinWidth }}>
            <div className="relative flex items-stretch gap-2 border-l border-chart-axis" style={{ height: PLOT_HEIGHT }}>
              {ticks.map((tick) => (
                <div
                  key={tick}
                  className="pointer-events-none absolute left-0 w-full border-t border-chart-grid"
                  style={{ bottom: `${(tick / max) * 100}%` }}
                />
              ))}

              {data.map((point, i) => {
                const total = totals[i];
                return (
                  <div key={point.label} className="group relative flex min-w-0 flex-1 flex-col items-center">
                    <span className="mb-1 shrink-0 whitespace-nowrap text-[11px] font-medium tabular-nums">{barLabels[i]}</span>
                    <div
                      tabIndex={total > 0 ? 0 : undefined}
                      role={total > 0 ? "img" : undefined}
                      aria-label={
                        total > 0
                          ? `${point.label}: ${series.map((s) => `${s.label} ${formatValue(point.values[s.key] ?? 0)}`).join(", ")}`
                          : undefined
                      }
                      className="flex w-full max-w-6 flex-1 flex-col-reverse gap-0.5 rounded-t-[4px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {series.map((s) => {
                        const value = point.values[s.key] ?? 0;
                        if (value <= 0) return null;
                        return (
                          <div
                            key={s.key}
                            className={`w-full first:rounded-t-[4px] ${s.colorClassName}`}
                            style={{ height: `${(value / max) * 100}%` }}
                          />
                        );
                      })}
                    </div>

                    <div className="pointer-events-none absolute top-0 left-1/2 z-10 hidden w-max -translate-x-1/2 whitespace-nowrap rounded-md border bg-popover px-2 py-1.5 text-xs shadow-md group-hover:block group-focus-within:block">
                      <p className="font-medium text-popover-foreground">{point.label}</p>
                      {series.map((s) => (
                        <p key={s.key} className="flex items-center gap-1.5 text-muted-foreground">
                          <span className={`size-1.5 rounded-full ${s.colorClassName}`} />
                          {s.label}: <span className="font-medium text-popover-foreground">{formatValue(point.values[s.key] ?? 0)}</span>
                        </p>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-2 pt-1.5">
              {data.map((point) => (
                <span key={point.label} className="min-w-0 flex-1 text-center text-xs leading-tight text-muted-foreground">
                  {point.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

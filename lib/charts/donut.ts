/**
 * Geometry for the donut (pie) chart. Pure functions so the folding,
 * percentages and arc paths are unit-tested rather than eyeballed.
 */

export interface Slice {
  key: string;
  label: string;
  value: number;
  /** Any CSS color, typically a `var(--chart-n)` token. */
  color: string;
}

export interface DonutSegment extends Slice {
  /** Fraction of the total, 0..1. */
  share: number;
  /** Whole-number percent; all segments' percents add up to exactly 100. */
  percent: number;
  /** Radians, clockwise from 12 o'clock. */
  startAngle: number;
  endAngle: number;
}

/** Part-to-whole only reads at a glance with a handful of parts. */
export const MAX_DONUT_SLICES = 6;

/**
 * Drops empty/negative slices, sorts largest-first, and folds everything
 * past `max - 1` into a single "Other" slice, so a donut never grows a 7th
 * color (the categorical palette is assigned in fixed order, never cycled).
 */
export function foldSlices(slices: Slice[], other: { label: string; color: string }, max = MAX_DONUT_SLICES): Slice[] {
  const positive = slices.filter((s) => s.value > 0).sort((a, b) => b.value - a.value);
  if (positive.length <= max) return positive;
  // The data's own "other" slice joins the fold, so "Other" never appears twice.
  const named = positive.filter((s) => s.key !== "other");
  const kept = named.slice(0, max - 1);
  const rest = positive.filter((s) => !kept.includes(s)).reduce((sum, s) => sum + s.value, 0);
  return [...kept, { key: "__other", label: other.label, value: rest, color: other.color }];
}

/**
 * Whole-number percentages that always total 100 (largest-remainder
 * method), so a legend never reads 33% + 33% + 33%.
 */
export function wholePercents(values: number[]): number[] {
  const total = values.reduce((sum, v) => sum + v, 0);
  if (total <= 0) return values.map(() => 0);
  const raw = values.map((v) => (v / total) * 100);
  const floors = raw.map(Math.floor);
  let remaining = 100 - floors.reduce((sum, v) => sum + v, 0);
  const byRemainder = raw.map((v, i) => ({ i, r: v - Math.floor(v) })).sort((a, b) => b.r - a.r || a.i - b.i);
  for (const { i } of byRemainder) {
    if (remaining <= 0) break;
    floors[i] += 1;
    remaining -= 1;
  }
  return floors;
}

export function donutSegments(slices: Slice[]): DonutSegment[] {
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  if (total <= 0) return [];
  const percents = wholePercents(slices.map((s) => s.value));
  let angle = 0;
  return slices.map((slice, i) => {
    const share = slice.value / total;
    const startAngle = angle;
    angle += share * Math.PI * 2;
    return { ...slice, share, percent: percents[i], startAngle, endAngle: angle };
  });
}

function point(cx: number, cy: number, r: number, angle: number): string {
  // 0 rad = 12 o'clock, increasing clockwise.
  const x = cx + r * Math.sin(angle);
  const y = cy - r * Math.cos(angle);
  return `${round(x)} ${round(y)}`;
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/**
 * SVG path for one ring segment. A full circle can't be one arc command
 * (start == end), so a lone 100% slice is drawn as two half-rings.
 */
export function ringSegmentPath(
  cx: number,
  cy: number,
  outerRadius: number,
  innerRadius: number,
  startAngle: number,
  endAngle: number
): string {
  const sweep = endAngle - startAngle;
  if (sweep >= Math.PI * 2 - 1e-9) {
    const mid = startAngle + Math.PI;
    return (
      ringSegmentPath(cx, cy, outerRadius, innerRadius, startAngle, mid) +
      " " +
      ringSegmentPath(cx, cy, outerRadius, innerRadius, mid, startAngle + Math.PI * 2)
    );
  }
  const large = sweep > Math.PI ? 1 : 0;
  return [
    `M ${point(cx, cy, outerRadius, startAngle)}`,
    `A ${outerRadius} ${outerRadius} 0 ${large} 1 ${point(cx, cy, outerRadius, endAngle)}`,
    `L ${point(cx, cy, innerRadius, endAngle)}`,
    `A ${innerRadius} ${innerRadius} 0 ${large} 0 ${point(cx, cy, innerRadius, startAngle)}`,
    "Z",
  ].join(" ");
}

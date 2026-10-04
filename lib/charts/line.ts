/** Geometry for the line chart: scaling, path building, and pointer snapping. */

export interface PlotPoint {
  x: number;
  y: number;
}

/**
 * Maps values onto a plot `width` x `height` (SVG coordinates, y down),
 * evenly spaced on x with the first and last values on the edges. A single
 * value sits in the middle.
 */
export function scalePoints(values: number[], width: number, height: number, max: number): PlotPoint[] {
  const safeMax = max > 0 ? max : 1;
  const n = values.length;
  return values.map((value, i) => ({
    x: n === 1 ? width / 2 : (i / (n - 1)) * width,
    y: height - (Math.max(0, value) / safeMax) * height,
  }));
}

export function linePath(points: PlotPoint[]): string {
  return points.map((p, i) => `${i === 0 ? "M" : "L"} ${round(p.x)} ${round(p.y)}`).join(" ");
}

/** The line's path closed down to the baseline, for the 10% area wash. */
export function areaPath(points: PlotPoint[], height: number): string {
  if (points.length === 0) return "";
  const first = points[0];
  const last = points[points.length - 1];
  return `${linePath(points)} L ${round(last.x)} ${round(height)} L ${round(first.x)} ${round(height)} Z`;
}

/** The data index nearest a pointer's x position (the crosshair snaps to it). */
export function nearestIndex(x: number, count: number, width: number): number {
  if (count <= 1 || width <= 0) return 0;
  const index = Math.round((x / width) * (count - 1));
  return Math.min(count - 1, Math.max(0, index));
}

/** Running total, e.g. daily spending -> spending to date. */
export function cumulative(values: number[]): number[] {
  let sum = 0;
  return values.map((v) => (sum += v));
}

/**
 * Which x labels to print: first, last, and evenly spaced ones between, so
 * labels never collide however many points there are.
 */
export function labelIndexes(count: number, maxLabels = 5): number[] {
  if (count <= 0) return [];
  if (count <= maxLabels) return Array.from({ length: count }, (_, i) => i);
  const step = (count - 1) / (maxLabels - 1);
  return Array.from({ length: maxLabels }, (_, i) => Math.round(i * step));
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

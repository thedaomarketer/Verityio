import { describe, expect, it } from "vitest";
import { areaPath, cumulative, labelIndexes, linePath, nearestIndex, scalePoints } from "@/lib/charts/line";

describe("scalePoints", () => {
  it("spreads points edge to edge and flips y so bigger is higher", () => {
    expect(scalePoints([0, 50, 100], 200, 100, 100)).toEqual([
      { x: 0, y: 100 },
      { x: 100, y: 50 },
      { x: 200, y: 0 },
    ]);
  });

  it("centers a single point and survives a zero max", () => {
    expect(scalePoints([0], 200, 100, 0)).toEqual([{ x: 100, y: 100 }]);
  });

  it("clamps negatives to the baseline", () => {
    expect(scalePoints([-5, 10], 10, 10, 10)[0].y).toBe(10);
  });
});

describe("paths", () => {
  it("builds a polyline and closes the area to the baseline", () => {
    const points = [
      { x: 0, y: 10 },
      { x: 5, y: 2 },
    ];
    expect(linePath(points)).toBe("M 0 10 L 5 2");
    expect(areaPath(points, 20)).toBe("M 0 10 L 5 2 L 5 20 L 0 20 Z");
    expect(areaPath([], 20)).toBe("");
  });
});

describe("nearestIndex", () => {
  it("snaps to the closest point and clamps to the ends", () => {
    expect(nearestIndex(0, 5, 100)).toBe(0);
    expect(nearestIndex(60, 5, 100)).toBe(2);
    expect(nearestIndex(63, 5, 100)).toBe(3);
    expect(nearestIndex(500, 5, 100)).toBe(4);
    expect(nearestIndex(-10, 5, 100)).toBe(0);
    expect(nearestIndex(10, 1, 100)).toBe(0);
  });
});

describe("cumulative", () => {
  it("returns running totals", () => {
    expect(cumulative([1, 2, 3, 0])).toEqual([1, 3, 6, 6]);
  });
});

describe("labelIndexes", () => {
  it("labels every point when there are few", () => {
    expect(labelIndexes(3)).toEqual([0, 1, 2]);
  });

  it("always includes the first and last of many", () => {
    expect(labelIndexes(31)).toEqual([0, 8, 15, 23, 30]);
  });

  it("handles no data", () => {
    expect(labelIndexes(0)).toEqual([]);
  });
});

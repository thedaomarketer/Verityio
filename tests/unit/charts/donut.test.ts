import { describe, expect, it } from "vitest";
import { donutSegments, foldSlices, ringSegmentPath, wholePercents, type Slice } from "@/lib/charts/donut";

const OTHER = { label: "Other", color: "var(--chart-8)" };
const slice = (key: string, value: number): Slice => ({ key, label: key, value, color: `c-${key}` });

describe("foldSlices", () => {
  it("drops zero and negative slices and sorts largest first", () => {
    expect(foldSlices([slice("a", 1), slice("b", 0), slice("c", 5), slice("d", -2)], OTHER).map((s) => s.key)).toEqual([
      "c",
      "a",
    ]);
  });

  it("keeps up to six slices untouched", () => {
    const six = ["a", "b", "c", "d", "e", "f"].map((k, i) => slice(k, 10 - i));
    expect(foldSlices(six, OTHER)).toHaveLength(6);
  });

  it("folds everything past the fifth slice into Other", () => {
    const eight = ["a", "b", "c", "d", "e", "f", "g", "h"].map((k, i) => slice(k, 100 - i * 10));
    const folded = foldSlices(eight, OTHER);
    expect(folded).toHaveLength(6);
    expect(folded[5]).toEqual({ key: "__other", label: "Other", value: 50 + 40 + 30, color: "var(--chart-8)" });
  });
});

describe("foldSlices with the data's own other", () => {
  it("merges an existing 'other' slice into the fold instead of showing Other twice", () => {
    const seven = [slice("other", 95), ...["a", "b", "c", "d", "e", "f"].map((k, i) => slice(k, 90 - i * 10))];
    const folded = foldSlices(seven, OTHER);
    expect(folded.map((s) => s.key)).toEqual(["a", "b", "c", "d", "e", "__other"]);
    expect(folded[5].value).toBe(95 + 40);
  });
});

describe("wholePercents", () => {
  it("always totals exactly 100", () => {
    expect(wholePercents([1, 1, 1])).toEqual([34, 33, 33]);
    expect(wholePercents([2, 1]).reduce((a, b) => a + b)).toBe(100);
    expect(wholePercents([7, 13, 29, 51]).reduce((a, b) => a + b)).toBe(100);
  });

  it("returns zeros for an empty total", () => {
    expect(wholePercents([0, 0])).toEqual([0, 0]);
  });
});

describe("donutSegments", () => {
  it("splits the circle in proportion, clockwise from 12 o'clock", () => {
    const segments = donutSegments([slice("a", 3), slice("b", 1)]);
    expect(segments[0].startAngle).toBe(0);
    expect(segments[0].endAngle).toBeCloseTo(Math.PI * 1.5);
    expect(segments[1].endAngle).toBeCloseTo(Math.PI * 2);
    expect(segments.map((s) => s.percent)).toEqual([75, 25]);
  });

  it("returns nothing when there's no total", () => {
    expect(donutSegments([])).toEqual([]);
  });
});

describe("ringSegmentPath", () => {
  it("draws a quarter ring between the right radii", () => {
    expect(ringSegmentPath(50, 50, 40, 30, 0, Math.PI / 2)).toBe(
      "M 50 10 A 40 40 0 0 1 90 50 L 80 50 A 30 30 0 0 0 50 20 Z"
    );
  });

  it("uses the large-arc flag past half a turn", () => {
    expect(ringSegmentPath(50, 50, 40, 30, 0, Math.PI * 1.5)).toContain("A 40 40 0 1 1");
  });

  it("draws a lone 100% slice as two half rings", () => {
    const path = ringSegmentPath(50, 50, 40, 30, 0, Math.PI * 2);
    expect(path.match(/Z/g)).toHaveLength(2);
  });
});

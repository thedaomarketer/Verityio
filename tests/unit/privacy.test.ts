import { describe, expect, it } from "vitest";

import { parseHideAmounts } from "@/lib/privacy";

describe("parseHideAmounts", () => {
  it("only hides on the exact cookie value", () => {
    expect(parseHideAmounts("1")).toBe(true);
    expect(parseHideAmounts("0")).toBe(false);
    expect(parseHideAmounts("")).toBe(false);
    expect(parseHideAmounts(undefined)).toBe(false);
    expect(parseHideAmounts("true")).toBe(false);
  });
});

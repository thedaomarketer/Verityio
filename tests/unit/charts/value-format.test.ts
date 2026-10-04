import { describe, expect, it } from "vitest";

import { makeAxisFormatter, makeFormatter } from "@/lib/charts/value-format";

describe("chart value formats", () => {
  it("formats money from cents, with cents in values and without on axes", () => {
    const money = { kind: "money" as const, currency: "USD", intl: "en-US" };
    expect(makeFormatter(money)(123456)).toBe("$1,234.56");
    expect(makeAxisFormatter(money)(100000)).toBe("$1,000");
  });

  it("formats minutes as hours in the user's language", () => {
    expect(makeFormatter({ kind: "hours", locale: "en" })(150)).toBe("2h 30m");
    // French separates the unit with a non-breaking space.
    expect(makeAxisFormatter({ kind: "hours", locale: "fr" })(120).replace(/\s/g, " ")).toBe("2 h");
  });
});

import { describe, expect, it } from "vitest";

import { fileNameFromDisposition } from "@/lib/download";

describe("fileNameFromDisposition", () => {
  it("reads quoted and unquoted file names", () => {
    expect(fileNameFromDisposition('attachment; filename="verityio-hours.csv"', "x")).toBe("verityio-hours.csv");
    expect(fileNameFromDisposition("attachment; filename=export.json", "x")).toBe("export.json");
  });

  it("prefers the UTF-8 form", () => {
    expect(fileNameFromDisposition("attachment; filename=\"a.csv\"; filename*=UTF-8''d%C3%A9penses.csv", "x")).toBe("dépenses.csv");
  });

  it("falls back when missing and strips path tricks", () => {
    expect(fileNameFromDisposition(null, "fallback.csv")).toBe("fallback.csv");
    expect(fileNameFromDisposition('attachment; filename="../../etc/passwd"', "x")).toBe("....etcpasswd");
    expect(fileNameFromDisposition('attachment; filename="/"', "safe.csv")).toBe("safe.csv");
  });
});

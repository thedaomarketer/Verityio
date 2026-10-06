import { describe, expect, it } from "vitest";

import { normalizeReceiptScan, type ReceiptScan } from "@/lib/ai/receipt-fields";

const base: ReceiptScan = { is_receipt: true, merchant: "Joe's Diner", total: "42.10", currency: "CAD", date: "2026-10-04", category: "meals" };
const today = "2026-10-06";

describe("normalizeReceiptScan", () => {
  it("passes clean values through", () => {
    expect(normalizeReceiptScan(base, today)).toEqual({ merchant: "Joe's Diner", amount: "42.10", currency: "CAD", date: "2026-10-04", category: "meals" });
  });

  it("returns nothing for something that isn't a receipt", () => {
    expect(normalizeReceiptScan({ ...base, is_receipt: false }, today)).toBeNull();
  });

  it("normalizes amounts and drops ones that don't parse", () => {
    expect(normalizeReceiptScan({ ...base, total: "1,234.5" }, today)?.amount).toBe("1234.50");
    expect(normalizeReceiptScan({ ...base, total: "$7" }, today)?.amount).toBe("7.00");
    expect(normalizeReceiptScan({ ...base, total: "12,50 €" }, today)?.amount).toBeNull();
    expect(normalizeReceiptScan({ ...base, total: "0.00" }, today)?.amount).toBeNull();
    expect(normalizeReceiptScan({ ...base, total: "9999999" }, today)?.amount).toBeNull();
    expect(normalizeReceiptScan({ ...base, total: null }, today)?.amount).toBeNull();
  });

  it("drops impossible, future and very old dates", () => {
    expect(normalizeReceiptScan({ ...base, date: "2026-02-30" }, today)?.date).toBeNull();
    expect(normalizeReceiptScan({ ...base, date: "2026-10-07" }, today)?.date).toBeNull();
    expect(normalizeReceiptScan({ ...base, date: "2015-01-01" }, today)?.date).toBeNull();
    expect(normalizeReceiptScan({ ...base, date: "October 4" }, today)?.date).toBeNull();
  });

  it("keeps only valid currency codes and trims the merchant", () => {
    expect(normalizeReceiptScan({ ...base, currency: "usd" }, today)?.currency).toBe("USD");
    expect(normalizeReceiptScan({ ...base, currency: "dollars" }, today)?.currency).toBeNull();
    expect(normalizeReceiptScan({ ...base, merchant: "   " }, today)?.merchant).toBeNull();
  });
});

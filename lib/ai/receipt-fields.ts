import { z } from "zod";

export const RECEIPT_CATEGORIES = ["meals", "transport", "supplies", "equipment", "lodging", "other"] as const;

/**
 * What Claude returns for a receipt (enforced by structured outputs). Money
 * is a decimal *string* -- never a float -- and is converted to cents only
 * after validation.
 */
export const ReceiptScanSchema = z.object({
  is_receipt: z.boolean().describe("True only if the image is a receipt, invoice or bill."),
  merchant: z.string().nullable().describe("The business name as printed, or null."),
  total: z
    .string()
    .nullable()
    .describe("The final amount paid (including tax and tip), digits with a dot as decimal separator, e.g. 42.10. Null if unclear."),
  currency: z.string().nullable().describe("ISO 4217 code such as USD or CAD if printed or clearly implied, else null."),
  date: z.string().nullable().describe("Transaction date as YYYY-MM-DD, or null if not printed."),
  category: z.enum(RECEIPT_CATEGORIES).nullable().describe("Best-fitting expense category, or null."),
});
export type ReceiptScan = z.infer<typeof ReceiptScanSchema>;

export interface ReceiptFields {
  merchant: string | null;
  /** Decimal string ready for the amount input, e.g. "42.10". */
  amount: string | null;
  currency: string | null;
  date: string | null;
  category: (typeof RECEIPT_CATEGORIES)[number] | null;
}

function isRealDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/**
 * Turns the model's answer into form values, dropping anything that doesn't
 * hold up: amounts must be plain positive decimals (thousands separators
 * removed) under $1M, dates must be real and not in the future (receipts
 * don't come from tomorrow) or more than ten years old. Whatever is dropped
 * is simply left for the user to type -- never guessed.
 */
export function normalizeReceiptScan(scan: ReceiptScan, today: string): ReceiptFields | null {
  if (!scan.is_receipt) return null;

  let amount: string | null = null;
  const rawTotal = scan.total?.replace(/[,\s]/g, "").replace(/^[^\d]+/, "") ?? "";
  if (/^\d{1,6}(\.\d{1,2})?$/.test(rawTotal) && Number(rawTotal) > 0) {
    const [whole, cents = ""] = rawTotal.split(".");
    amount = `${Number(whole)}.${cents.padEnd(2, "0")}`;
  }

  const tenYearsAgo = `${Number(today.slice(0, 4)) - 10}${today.slice(4)}`;
  const date = scan.date && isRealDate(scan.date) && scan.date <= today && scan.date >= tenYearsAgo ? scan.date : null;
  const currency = scan.currency && /^[A-Z]{3}$/.test(scan.currency.trim().toUpperCase()) ? scan.currency.trim().toUpperCase() : null;
  const merchant = scan.merchant?.trim().slice(0, 120) || null;

  return { merchant, amount, currency, date, category: scan.category };
}

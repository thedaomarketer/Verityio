/**
 * Stripe's API takes application/x-www-form-urlencoded bodies with nested
 * keys in bracket notation: { line_items: [{ price: "p" }] } becomes
 * `line_items[0][price]=p`. Undefined/null values are skipped.
 */
export type FormValue = string | number | boolean | null | undefined | FormValue[] | { [key: string]: FormValue };

export function stripeFormEncode(params: Record<string, FormValue>): string {
  const pairs: string[] = [];
  const walk = (prefix: string, value: FormValue) => {
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) {
      value.forEach((item, i) => walk(`${prefix}[${i}]`, item));
    } else if (typeof value === "object") {
      for (const [key, nested] of Object.entries(value)) walk(`${prefix}[${key}]`, nested);
    } else {
      pairs.push(`${encodeURIComponent(prefix)}=${encodeURIComponent(String(value))}`);
    }
  };
  for (const [key, value] of Object.entries(params)) walk(key, value);
  return pairs.join("&");
}

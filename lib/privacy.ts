/**
 * "Hide balances": a per-device display preference that masks money
 * figures (bank balances, headline earnings and spending) for when someone
 * can see your screen. It's a cookie so the server renders the page already
 * masked -- no flash of the real numbers on load. Not a security control:
 * the values still reach the browser.
 */
export const HIDE_AMOUNTS_COOKIE = "wl-hide-amounts";

/** What a masked amount shows instead of the number. */
export const MASKED_AMOUNT = "••••••";

export function parseHideAmounts(value: string | undefined | null): boolean {
  return value === "1";
}

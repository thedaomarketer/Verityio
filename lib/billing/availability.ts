import "server-only";

import { isAssistantConfigured } from "@/lib/ai/env";
import { isPlaidConfigured } from "@/lib/bank/plaid";

/** Bank linking works with real banks (Plaid production), not just Plaid's test banks. */
export function isBankLinkingLive(): boolean {
  return isPlaidConfigured() && process.env.PLAID_ENV?.trim() === "production";
}

/**
 * Pro can only be bought once at least one of its features actually works
 * for customers: until then the pricing page shows it as "coming soon".
 */
export function isProAvailable(): boolean {
  return isAssistantConfigured() || isBankLinkingLive();
}

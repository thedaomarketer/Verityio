import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verifies a `Stripe-Signature` header (t=<unix>,v1=<hex hmac>[,v1=...])
 * against the raw request body, per Stripe's webhook signing scheme:
 * HMAC-SHA256 of `${t}.${body}` with the endpoint's signing secret. Rejects
 * stale timestamps (replay protection; Stripe's default tolerance is 5 min).
 */
export function verifyStripeSignature(
  payload: string,
  header: string | null,
  secret: string,
  { toleranceSeconds = 300, now = Date.now() }: { toleranceSeconds?: number; now?: number } = {}
): boolean {
  if (!header || !secret) return false;

  let timestamp: number | null = null;
  const signatures: string[] = [];
  for (const part of header.split(",")) {
    const [key, value] = part.split("=", 2).map((s) => s?.trim());
    if (key === "t" && value && /^\d+$/.test(value)) timestamp = Number(value);
    if (key === "v1" && value && /^[0-9a-f]+$/i.test(value)) signatures.push(value.toLowerCase());
  }
  if (timestamp === null || signatures.length === 0) return false;
  if (Math.abs(now / 1000 - timestamp) > toleranceSeconds) return false;

  const expected = Buffer.from(createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex"));
  return signatures.some((signature) => {
    const given = Buffer.from(signature);
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

/** Builds a valid header -- for tests and local webhook replays. */
export function signStripePayload(payload: string, secret: string, timestamp: number): string {
  const signature = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
  return `t=${timestamp},v1=${signature}`;
}

import "server-only";

/**
 * Server-side OneSignal sender. Configuration:
 * - NEXT_PUBLIC_ONESIGNAL_APP_ID: the app id (public; the browser SDK needs it).
 * - ONESIGNAL_REST_API_KEY: the app's REST API key (secret, server-only).
 * Without both, push is "not configured" and the UI says so.
 */

const ONESIGNAL_API_URL = "https://api.onesignal.com/notifications?c=push";
const TIMEOUT_MS = 8000;

export function getOneSignalAppId(): string | null {
  return process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID?.trim() || null;
}

function getRestApiKey(): string | null {
  return process.env.ONESIGNAL_REST_API_KEY?.trim() || null;
}

export function isPushConfigured(): boolean {
  return Boolean(getOneSignalAppId() && getRestApiKey());
}

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export interface PushMessage {
  subscriptionIds: string[];
  title: string;
  body: string;
  /** Path in the app to open when tapped, e.g. "/time". */
  path: string;
  /** Lets OneSignal drop an accidental duplicate send (it must be a UUID). */
  idempotencyKey?: string;
}

/**
 * Sends one notification to specific device subscriptions. Returns false
 * (after logging) on any failure -- callers decide whether that matters.
 * Text is already in the recipient's language, so it goes under "en",
 * OneSignal's required default.
 */
export async function sendPush(message: PushMessage): Promise<boolean> {
  const appId = getOneSignalAppId();
  const key = getRestApiKey();
  if (!appId || !key || message.subscriptionIds.length === 0) return false;

  // Current "App API keys" start with os_v2_ and use the Key scheme; legacy
  // REST keys use Basic.
  const authorization = key.startsWith("os_v2_") ? `Key ${key}` : `Basic ${key}`;

  try {
    const response = await fetch(ONESIGNAL_API_URL, {
      method: "POST",
      headers: { Authorization: authorization, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        app_id: appId,
        target_channel: "push",
        include_subscription_ids: message.subscriptionIds,
        headings: { en: message.title },
        contents: { en: message.body },
        url: `${siteUrl()}${message.path}`,
        chrome_web_icon: `${siteUrl()}/icons/icon-192.png`,
        ...(message.idempotencyKey && { idempotency_key: message.idempotencyKey }),
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });

    if (!response.ok) {
      console.error("OneSignal send failed", response.status, await response.text().catch(() => ""));
      return false;
    }
    return true;
  } catch (error) {
    console.error("OneSignal send failed", error);
    return false;
  }
}

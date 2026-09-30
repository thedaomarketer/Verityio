import "server-only";

import { cookies } from "next/headers";

/**
 * Remembers which OneSignal subscription belongs to *this* browser, so the
 * settings page can show "on for this device" and signing out can unlink it
 * (otherwise a shared device would keep getting the previous user's
 * reminders). httpOnly: only the server needs it.
 */
const PUSH_DEVICE_COOKIE = "wl-push-id";

export async function getPushDeviceId(): Promise<string | null> {
  return (await cookies()).get(PUSH_DEVICE_COOKIE)?.value || null;
}

export async function setPushDeviceId(id: string): Promise<void> {
  (await cookies()).set(PUSH_DEVICE_COOKIE, id, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });
}

export async function clearPushDeviceId(): Promise<void> {
  (await cookies()).delete(PUSH_DEVICE_COOKIE);
}

"use client";

import { useEffect } from "react";

/**
 * Registers the app's one service worker at the site root. It's OneSignal's
 * worker file, which also imports the offline shell (sw.js), so push and
 * offline support share a single registration -- see public/OneSignalSDKWorker.js.
 */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/OneSignalSDKWorker.js", { scope: "/" })
      .then(async () => {
        // Retire the separate worker an earlier version registered for push.
        for (const registration of await navigator.serviceWorker.getRegistrations()) {
          if (registration.scope.endsWith("/push/onesignal/")) await registration.unregister();
        }
      })
      .catch(() => {
        // Offline caching and push are progressive enhancements -- if
        // registration fails (unsupported browser, blocked storage), the app
        // still works fully online.
      });
  }, []);

  return null;
}

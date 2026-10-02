"use client";

/**
 * Loads OneSignal's Web SDK (v16) on demand -- only when someone turns
 * notifications on or off -- rather than on every page, so the third-party
 * script never slows down or tracks ordinary use of the app.
 */

const SDK_URL = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js";

interface PushSubscriptionChange {
  current: { id?: string | null; optedIn?: boolean };
}

export interface OneSignalApi {
  init(options: Record<string, unknown>): Promise<void>;
  Notifications: {
    isPushSupported(): boolean;
    permissionNative?: "default" | "granted" | "denied";
  };
  User: {
    PushSubscription: {
      id?: string | null;
      optedIn?: boolean;
      optIn(): Promise<void>;
      optOut(): Promise<void>;
      addEventListener(event: "change", listener: (change: PushSubscriptionChange) => void): void;
      removeEventListener(event: "change", listener: (change: PushSubscriptionChange) => void): void;
    };
  };
}

declare global {
  interface Window {
    OneSignalDeferred?: Array<(oneSignal: OneSignalApi) => void | Promise<void>>;
  }
}

let loading: Promise<OneSignalApi> | null = null;

export function loadOneSignal(appId: string): Promise<OneSignalApi> {
  if (loading) return loading;

  loading = new Promise<OneSignalApi>((resolve, reject) => {
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async (oneSignal) => {
      try {
        await oneSignal.init({
          appId,
          serviceWorkerPath: "push/onesignal/OneSignalSDKWorker.js",
          serviceWorkerParam: { scope: "/push/onesignal/" },
          allowLocalhostAsSecureOrigin: true,
          // Verity shows its own "turn on" button; no OneSignal prompts.
          promptOptions: { slidedown: { prompts: [] } },
          notifyButton: { enable: false },
        });
        resolve(oneSignal);
      } catch (error) {
        reject(error);
      }
    });

    const script = document.createElement("script");
    script.src = SDK_URL;
    script.defer = true;
    script.onerror = () => reject(new Error("Couldn't load the OneSignal SDK."));
    document.head.appendChild(script);
  }).catch((error) => {
    loading = null; // allow a retry after a network failure
    throw error;
  });

  return loading;
}

/** Waits for the device's subscription id, which OneSignal assigns shortly after opt-in. */
export function waitForSubscriptionId(oneSignal: OneSignalApi, timeoutMs = 15000): Promise<string> {
  const existing = oneSignal.User.PushSubscription.id;
  if (existing) return Promise.resolve(existing);

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      oneSignal.User.PushSubscription.removeEventListener("change", onChange);
      reject(new Error("Timed out waiting for a push subscription."));
    }, timeoutMs);

    function onChange(change: PushSubscriptionChange) {
      if (!change.current.id) return;
      clearTimeout(timer);
      oneSignal.User.PushSubscription.removeEventListener("change", onChange);
      resolve(change.current.id);
    }

    oneSignal.User.PushSubscription.addEventListener("change", onChange);
  });
}

/** Browser-level support check that doesn't need the SDK loaded. */
export function browserSupportsPush(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export function isIosWithoutHomeScreenInstall(): boolean {
  if (typeof window === "undefined") return false;
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone =
    window.matchMedia?.("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
  return ios && !standalone;
}

"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import { Bell, BellOff, Send } from "lucide-react";
import { toast } from "sonner";

import { removePushSubscriptionAction, savePushSubscriptionAction, sendTestNotificationAction } from "@/lib/actions/push";
import { useI18n } from "@/lib/i18n/client";
import {
  browserSupportsPush,
  isIosWithoutHomeScreenInstall,
  loadOneSignal,
  waitForSubscriptionId,
} from "@/lib/push/onesignal-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Support = "supported" | "unsupported" | "ios-install" | "denied";

const noopSubscribe = () => () => {};

function readSupport(): Support {
  if (isIosWithoutHomeScreenInstall()) return "ios-install";
  if (!browserSupportsPush()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  return "supported";
}

export function PushCard({
  appId,
  deviceEnabled,
  remindersEnabled,
}: {
  /** OneSignal app id; null when push isn't configured for this deployment. */
  appId: string | null;
  /** Whether this browser's subscription is already linked to the account. */
  deviceEnabled: boolean;
  /** The "Notifications" preference -- the master switch for reminders. */
  remindersEnabled: boolean;
}) {
  const { m } = useI18n();
  const t = m.push;
  const [enabled, setEnabled] = useState(deviceEnabled);
  const [isPending, startTransition] = useTransition();
  // Client-only capability check; null during server render (no hydration mismatch).
  const support = useSyncExternalStore<Support | null>(noopSubscribe, readSupport, () => null);

  function turnOn() {
    if (!appId) return;
    // Ask for permission first, directly in the click: Safari only shows the
    // prompt in response to a user gesture, and loading the SDK is async.
    const permission = Notification.requestPermission();

    startTransition(async () => {
      try {
        if ((await permission) !== "granted") {
          toast.error(t.denied);
          return;
        }
        const oneSignal = await loadOneSignal(appId);
        if (!oneSignal.Notifications.isPushSupported()) {
          toast.error(t.unsupported);
          return;
        }
        await oneSignal.User.PushSubscription.optIn();
        const subscriptionId = await waitForSubscriptionId(oneSignal);
        const result = await savePushSubscriptionAction(subscriptionId, navigator.userAgent);
        if (result.error) {
          toast.error(result.error);
          return;
        }
        setEnabled(true);
        toast.success(t.enabled);
      } catch (error) {
        console.error(error);
        toast.error(m.errors.pushSaveFailed);
      }
    });
  }

  function turnOff() {
    startTransition(async () => {
      if (appId) {
        try {
          const oneSignal = await loadOneSignal(appId);
          await oneSignal.User.PushSubscription.optOut();
        } catch {
          // Unlinking on our side below is what stops reminders; this is best-effort.
        }
      }
      const result = await removePushSubscriptionAction();
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setEnabled(false);
      toast.success(t.disabled);
    });
  }

  function sendTest() {
    startTransition(async () => {
      const result = await sendTestNotificationAction();
      if (result.error) toast.error(result.error);
      else toast.success(t.testSent);
    });
  }

  let notice: string | null = null;
  if (!appId) notice = t.notConfigured;
  else if (support === "ios-install") notice = t.iosHint;
  else if (support === "unsupported") notice = t.unsupported;
  else if (support === "denied" && !enabled) notice = t.denied;

  const canToggle = Boolean(appId) && (support === "supported" || (support === "denied" && enabled));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Bell className="size-4" aria-hidden="true" /> {t.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{t.body}</p>

        {notice && <p className="rounded-xl bg-muted px-3.5 py-2.5 text-sm text-muted-foreground">{notice}</p>}

        {canToggle && (
          <>
            <p className="text-sm font-medium" role="status">
              {enabled ? t.onForDevice : t.offForDevice}
            </p>
            {!remindersEnabled && enabled && <p className="text-xs text-muted-foreground">{t.remindersOff}</p>}
            <div className="flex flex-wrap gap-2">
              {enabled ? (
                <>
                  <Button variant="outline" onClick={sendTest} disabled={isPending}>
                    <Send /> {t.sendTest}
                  </Button>
                  <Button variant="ghost" onClick={turnOff} disabled={isPending}>
                    <BellOff /> {t.disable}
                  </Button>
                </>
              ) : (
                <Button onClick={turnOn} disabled={isPending}>
                  <Bell /> {isPending ? t.enabling : t.enable}
                </Button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

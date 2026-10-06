import { redirect } from "next/navigation";
import { Download } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/data/context";
import { getOrCreateUserSettings } from "@/lib/data/settings";
import { getI18n } from "@/lib/i18n/server";
import { DownloadButton } from "@/components/download-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProfileForm } from "@/components/settings/profile-form";
import { AvatarUpload } from "@/components/settings/avatar-upload";
import { initials } from "@/components/app-shell/header";
import { PreferencesForm } from "@/components/settings/preferences-form";
import { RegionForm } from "@/components/settings/region-form";
import { PushCard } from "@/components/settings/push-card";
import { getOneSignalAppId, isPushConfigured } from "@/lib/push/onesignal";
import { getPushDeviceId } from "@/lib/push/device-cookie";
import { DeleteAccountDialog } from "@/components/settings/delete-account-dialog";
import { BillingCard } from "@/components/settings/billing-card";
import { getEntitlement } from "@/lib/data/subscription";

export default async function SettingsPage() {
  const [ctx, { m }] = await Promise.all([requireUserContext(), getI18n()]);
  if (!ctx) redirect("/login");

  const supabase = await createClient();
  const pushDeviceId = await getPushDeviceId();
  const [{ data: profile }, settings, { data: pushDevice }, entitlement] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", ctx.userId).maybeSingle(),
    getOrCreateUserSettings(supabase, ctx.userId),
    pushDeviceId
      ? supabase.from("push_subscriptions").select("id").eq("onesignal_id", pushDeviceId).maybeSingle()
      : Promise.resolve({ data: null }),
    getEntitlement(ctx.userId),
  ]);

  // Never a blank page: let the (app) error boundary explain and offer a retry.
  if (!profile || !settings) throw new Error("Could not load account settings.");

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-[28px] leading-tight font-bold tracking-tight md:text-3xl">{m.settings.title}</h1>

      <AvatarUpload
        userId={ctx.userId}
        avatarVersion={profile.avatar_url}
        initials={initials(profile.full_name, profile.email)}
        name={profile.full_name || profile.email || m.header.yourAccount}
      />
      <BillingCard entitlement={entitlement} timezone={ctx.timezone} />
      <ProfileForm profile={profile} />
      <RegionForm profile={{ locale: profile.locale, timezone: ctx.timezone, currency: profile.currency }} />
      <PreferencesForm settings={settings} />
      <PushCard
        appId={isPushConfigured() ? getOneSignalAppId() : null}
        deviceEnabled={Boolean(pushDevice)}
        remindersEnabled={settings.notifications_enabled}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{m.settings.data.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-muted-foreground">{m.settings.data.body}</p>
          <DownloadButton href="/api/account/export" fallbackName="verityio-export.json" size="default">
            <Download /> {m.settings.data.export}
          </DownloadButton>
        </CardContent>
      </Card>

      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-base text-destructive">{m.settings.danger.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-muted-foreground">{m.settings.danger.body}</p>
          <DeleteAccountDialog />
        </CardContent>
      </Card>
    </div>
  );
}

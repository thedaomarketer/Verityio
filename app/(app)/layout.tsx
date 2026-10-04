import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { SidebarNav } from "@/components/app-shell/sidebar-nav";
import { MobileNav } from "@/components/app-shell/mobile-nav";
import { Header } from "@/components/app-shell/header";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { TimeZonePrompt } from "@/components/app-shell/time-zone-prompt";
import { safeTimeZone } from "@/lib/timezone";
import { HIDE_AMOUNTS_COOKIE, parseHideAmounts } from "@/lib/privacy";
import { AmountsVisibilityProvider } from "@/components/privacy/amounts-visibility";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, timezone, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  const hideAmounts = parseHideAmounts((await cookies()).get(HIDE_AMOUNTS_COOKIE)?.value);

  return (
    <AmountsVisibilityProvider initialHidden={hideAmounts}>
      <div className="flex min-h-svh">
        <SidebarNav />
        <div className="flex min-w-0 flex-1 flex-col">
          <Header
              fullName={profile?.full_name ?? null}
              email={profile?.email ?? user.email ?? null}
              avatarVersion={profile?.avatar_url ?? null}
            />
          <TimeZonePrompt savedTimeZone={safeTimeZone(profile?.timezone)} />
          <InstallPrompt />
          <main className="flex-1 pb-[calc(7rem+env(safe-area-inset-bottom))] md:pb-0">
            <div className="mx-auto w-full max-w-6xl p-4 md:p-6">{children}</div>
          </main>
        </div>
        <MobileNav />
      </div>
    </AmountsVisibilityProvider>
  );
}

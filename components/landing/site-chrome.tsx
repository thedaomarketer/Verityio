import Link from "next/link";

import { getI18n } from "@/lib/i18n/server";
import { APP_NAME } from "@/lib/brand";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/language-switcher";
import { BrandMark } from "@/components/brand-mark";
import { BrandCredit } from "@/components/brand-credit";

/** The signed-out site's top bar (homepage and pricing). */
export async function SiteHeader({ signInHref = "/login" }: { signInHref?: string }) {
  const { m } = await getI18n();
  const t = m.landing;
  return (
    <header className="glass sticky top-0 z-30 border-b border-black/[0.06] pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 text-[17px] font-semibold tracking-tight">
          <BrandMark className="size-7" />
          {APP_NAME}
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2">
          <LanguageSwitcher className="max-sm:hidden" />
          <Button asChild variant="ghost" size="sm" className="max-sm:px-2.5">
            <Link href="/pricing">{t.pricing}</Link>
          </Button>
          <Button asChild variant="ghost" size="sm" className="max-sm:px-2.5">
            <Link href={signInHref}>{t.signIn}</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/register">{t.getStarted}</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}

/** The signed-out site's footer (homepage and pricing). */
export async function SiteFooter() {
  const { m } = await getI18n();
  const t = m.landing;
  return (
    <footer className="border-t border-black/[0.06] pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:px-6">
        <div className="space-y-1 text-center sm:text-left">
          <p>&copy; {new Date().getFullYear()} {APP_NAME}</p>
          <BrandCredit />
        </div>
        <div className="flex items-center gap-5">
          <LanguageSwitcher className="sm:hidden" />
          <Link href="/pricing" className="hover:text-foreground">
            {t.pricing}
          </Link>
          <Link href="/login" className="hover:text-foreground">
            {t.signIn}
          </Link>
          <Link href="/register" className="hover:text-foreground">
            {t.createAccountLink}
          </Link>
        </div>
      </div>
    </footer>
  );
}

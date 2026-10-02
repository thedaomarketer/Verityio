import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  BarChart3,
  BookText,
  ClipboardCheck,
  Clock,
  Download,
  Landmark,
  Lock,
  Receipt,
  Smartphone,
  Sparkles,
  Trash2,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { formatCents } from "@/lib/calculations/money";
import { formatMinutesAsHours } from "@/lib/format";
import { getI18n } from "@/lib/i18n/server";
import type { Locale } from "@/lib/i18n/config";
import type { Messages } from "@/lib/i18n/messages/en";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/language-switcher";
import { APP_NAME } from "@/lib/brand";

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await getI18n();
  return { title: m.meta.landingTitle, description: m.meta.landingDescription };
}

type FeatureKey = keyof Messages["landing"]["features"];

/** Literal Tailwind classes for each feature's icon tile. */
const FEATURES: { key: FeatureKey; icon: LucideIcon; tile: string }[] = [
  { key: "clockIn", icon: Clock, tile: "bg-[#0071e3]" },
  { key: "earnings", icon: Wallet, tile: "bg-[#248a3d]" },
  { key: "taxes", icon: Landmark, tile: "bg-[#5856d6]" },
  { key: "journal", icon: BookText, tile: "bg-[#8944ab]" },
  { key: "expenses", icon: Receipt, tile: "bg-[#c93400]" },
  { key: "reports", icon: BarChart3, tile: "bg-[#0e7c86]" },
  { key: "assistant", icon: Sparkles, tile: "bg-[#d1276b]" },
  { key: "mobile", icon: Smartphone, tile: "bg-[#48484a]" },
];

const PRIVACY_POINTS: { key: keyof Messages["landing"]["privacy"]; icon: LucideIcon }[] = [
  { key: "private", icon: Lock },
  { key: "export", icon: Download },
  { key: "delete", icon: Trash2 },
];

function AppIcon({ className = "size-8" }: { className?: string }) {
  return (
    <span
      className={`flex items-center justify-center rounded-[27%] bg-primary text-primary-foreground shadow-[0_4px_12px_rgb(0_113_227/0.3)] ${className}`}
    >
      <ClipboardCheck className="size-[55%]" />
    </span>
  );
}

/** A static, illustrative rendering of the app (not real data). */
function PhoneMockup({ m, locale, intl }: { m: Messages; locale: Locale; intl: string }) {
  const t = m.landing.mockup;
  const date = new Date(Date.UTC(2024, 5, 11)).toLocaleDateString(intl, {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
  return (
    <div aria-hidden="true" className="relative mx-auto w-[280px] select-none sm:w-[300px]">
      <div className="absolute -inset-10 -z-10 rounded-full bg-[radial-gradient(closest-side,rgb(0_113_227/0.25),transparent)] blur-2xl" />
      <div className="rounded-[48px] bg-[#1c1c1e] p-3 shadow-[0_30px_80px_rgb(0_0_0/0.25)]">
        <div className="relative overflow-hidden rounded-[38px] bg-background px-4 pt-10 pb-6">
          <div className="absolute top-3 left-1/2 h-6 w-24 -translate-x-1/2 rounded-full bg-[#1c1c1e]" />
          <p className="text-[11px] text-muted-foreground">{date}</p>
          <p className="text-xl font-bold tracking-tight">{t.greeting}</p>

          <div className="mt-4 rounded-2xl bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2 text-[11px] font-medium text-success">
              <span className="size-2 animate-pulse rounded-full bg-success" /> {t.clockedIn}
            </div>
            <p className="mt-1 text-3xl font-bold tracking-tight tabular-nums">3:42:18</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <span className="rounded-full bg-secondary py-2 text-center text-[11px] font-semibold text-primary">
                {t.startBreak}
              </span>
              <span className="rounded-full bg-primary py-2 text-center text-[11px] font-semibold text-primary-foreground">
                {t.clockOut}
              </span>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-card p-3 shadow-sm">
              <p className="text-[10px] text-muted-foreground">{t.thisWeek}</p>
              <p className="text-lg font-bold tracking-tight whitespace-nowrap">{formatMinutesAsHours(32 * 60 + 15, locale)}</p>
            </div>
            <div className="rounded-2xl bg-card p-3 shadow-sm">
              <p className="text-[10px] text-muted-foreground">{t.earnings}</p>
              <p className="text-lg font-bold tracking-tight">{formatCents(77400, "USD", intl)}</p>
            </div>
          </div>

          <div className="mt-3 rounded-2xl bg-card p-3 shadow-sm">
            <p className="text-[10px] text-muted-foreground">{t.hoursByWeek}</p>
            <div className="mt-2 flex h-16 items-end gap-2">
              {[45, 70, 55, 90, 62].map((h, i) => (
                <div key={i} className="flex flex-1 flex-col-reverse gap-0.5">
                  <div className="rounded-t-[3px] bg-chart-1" style={{ height: `${h * 0.55}px` }} />
                  {i === 3 && <div className="rounded-t-[3px] bg-chart-2" style={{ height: "8px" }} />}
                </div>
              ))}
            </div>
          </div>

          <div className="mx-auto mt-5 h-1 w-24 rounded-full bg-foreground/80" />
        </div>
      </div>
    </div>
  );
}

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/dashboard");

  const { locale, intl, m } = await getI18n();
  const t = m.landing;

  return (
    <div className="relative flex min-h-svh flex-col overflow-x-clip">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[640px] bg-[radial-gradient(60%_50%_at_20%_0%,rgb(0_113_227/0.14),transparent),radial-gradient(50%_45%_at_85%_10%,rgb(137_68_171/0.12),transparent)]"
      />

      <header className="glass sticky top-0 z-30 border-b border-black/[0.06] pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 text-[17px] font-semibold tracking-tight">
            <AppIcon className="size-7" />
            {APP_NAME}
          </Link>
          <nav className="flex items-center gap-1 sm:gap-2">
            <LanguageSwitcher className="max-sm:hidden" />
            <Button asChild variant="ghost" size="sm">
              <Link href="/login">{t.signIn}</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/register">{t.getStarted}</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto grid max-w-6xl items-center gap-14 px-4 pt-12 pb-16 sm:px-6 md:pt-20 lg:grid-cols-[1.1fr_1fr] lg:gap-8 lg:pb-24">
          <div className="text-center lg:text-left">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm">
              <span className="size-1.5 rounded-full bg-success" />
              {t.badge}
            </span>
            <h1 className="mt-5 text-[44px] leading-[1.05] font-bold tracking-tight sm:text-6xl lg:text-7xl">
              {t.heroLine1}
              <br />
              {t.heroLine2}
              <br />
              <span className="bg-gradient-to-r from-[#0071e3] to-[#8944ab] bg-clip-text text-transparent">
                {t.heroLine3}
              </span>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground lg:mx-0">
              {t.heroBody}
            </p>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
              <Button asChild size="lg" className="w-full sm:w-auto">
                <Link href="/register">
                  {t.createAccount} <ArrowRight />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
                <Link href="/login">{t.haveAccount}</Link>
              </Button>
            </div>
          </div>
          <PhoneMockup m={m} locale={locale} intl={intl} />
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{t.featuresTitle}</h2>
            <p className="mt-3 text-muted-foreground">{t.featuresBody}</p>
          </div>
          <div className="mt-10 grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
            {FEATURES.map((feature) => (
              <div
                key={feature.key}
                className="flex gap-4 rounded-3xl bg-card p-5 shadow-[0_1px_2px_rgb(0_0_0/0.04)] sm:block sm:p-6"
              >
                <span
                  className={`flex size-11 shrink-0 items-center justify-center rounded-[12px] text-white ${feature.tile}`}
                >
                  <feature.icon className="size-[22px]" />
                </span>
                <div>
                  <h3 className="font-semibold tracking-tight sm:mt-4">{t.features[feature.key].title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground sm:mt-1.5">{t.features[feature.key].body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="rounded-[32px] bg-[#1c1c1e] px-6 py-12 text-white sm:px-12">
            <h2 className="max-w-xl text-3xl font-bold tracking-tight sm:text-4xl">{t.privacyTitle}</h2>
            <p className="mt-3 max-w-xl text-white/70">{t.privacyBody}</p>
            <div className="mt-10 grid gap-8 sm:grid-cols-3">
              {PRIVACY_POINTS.map((point) => (
                <div key={point.key}>
                  <point.icon className="size-6 text-[#64d2ff]" />
                  <h3 className="mt-3 font-semibold">{t.privacy[point.key].title}</h3>
                  <p className="mt-1 text-sm text-white/70">{t.privacy[point.key].body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pt-8 pb-24 text-center sm:px-6">
          <AppIcon className="mx-auto size-16" />
          <h2 className="mt-6 text-3xl font-bold tracking-tight sm:text-4xl">{t.ctaTitle}</h2>
          <p className="mt-3 text-muted-foreground">{t.ctaBody}</p>
          <Button asChild size="lg" className="mt-8">
            <Link href="/register">
              {t.getStarted} <ArrowRight />
            </Link>
          </Button>
        </section>
      </main>

      <footer className="border-t border-black/[0.06] pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:px-6">
          <p>&copy; {new Date().getFullYear()} {APP_NAME}</p>
          <div className="flex items-center gap-5">
            <LanguageSwitcher className="sm:hidden" />
            <Link href="/login" className="hover:text-foreground">
              {t.signIn}
            </Link>
            <Link href="/register" className="hover:text-foreground">
              {t.createAccountLink}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

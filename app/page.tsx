import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  BarChart3,
  BookText,
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
import { getI18n } from "@/lib/i18n/server";
import type { Messages } from "@/lib/i18n/messages/en";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/language-switcher";
import { LiveDemo } from "@/components/landing/live-demo";
import { PayEstimator } from "@/components/landing/pay-estimator";
import { Reveal } from "@/components/landing/reveal";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { APP_NAME } from "@/lib/brand";
import { BrandMark } from "@/components/brand-mark";
import { BrandCredit } from "@/components/brand-credit";

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

export default async function Home({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { next } = await searchParams;
  if (user) redirect(safeRedirectPath(next, "/dashboard"));

  const { m } = await getI18n();
  const t = m.landing;
  // Someone who opened an app link while signed out lands here first; signing
  // in takes them on to where they were going.
  const continueTo = next ? safeRedirectPath(next, "") : "";
  const signInHref = continueTo ? `/login?redirectTo=${encodeURIComponent(continueTo)}` : "/login";

  return (
    <div className="relative flex min-h-svh flex-col overflow-x-clip">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[640px] bg-[radial-gradient(60%_50%_at_20%_0%,rgb(0_113_227/0.14),transparent),radial-gradient(50%_45%_at_85%_10%,rgb(137_68_171/0.12),transparent)]"
      />

      <header className="glass sticky top-0 z-30 border-b border-black/[0.06] pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 text-[17px] font-semibold tracking-tight">
            <BrandMark className="size-7" />
            {APP_NAME}
          </Link>
          <nav className="flex items-center gap-1 sm:gap-2">
            <LanguageSwitcher className="max-sm:hidden" />
            <Button asChild variant="ghost" size="sm">
              <Link href={signInHref}>{t.signIn}</Link>
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
                <Link href={signInHref}>{t.haveAccount}</Link>
              </Button>
            </div>
          </div>
          <LiveDemo />
        </section>

        <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <Reveal>
            <PayEstimator />
          </Reveal>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{t.featuresTitle}</h2>
            <p className="mt-3 text-muted-foreground">{t.featuresBody}</p>
          </div>
          <Reveal className="mt-10 grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
            {FEATURES.map((feature) => (
              <div
                key={feature.key}
                className="flex gap-4 rounded-3xl bg-card p-5 shadow-[0_1px_2px_rgb(0_0_0/0.04)] transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-[0_12px_32px_rgb(0_0_0/0.08)] sm:block sm:p-6"
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
          </Reveal>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <Reveal className="rounded-[32px] bg-[#1c1c1e] px-6 py-12 text-white sm:px-12">
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
          </Reveal>
        </section>

        <section className="mx-auto max-w-6xl px-4 pt-8 pb-24 text-center sm:px-6">
          <BrandMark className="mx-auto size-16" />
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
          <div className="space-y-1 text-center sm:text-left">
            <p>&copy; {new Date().getFullYear()} {APP_NAME}</p>
            <BrandCredit />
          </div>
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

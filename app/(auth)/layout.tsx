import Link from "next/link";
import { ChevronLeft, ClipboardCheck } from "lucide-react";

import { getI18n } from "@/lib/i18n/server";
import { LanguageSwitcher } from "@/components/language-switcher";
import { APP_NAME } from "@/lib/brand";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const { m } = await getI18n();
  return (
    <div className="relative flex min-h-svh flex-col px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(60%_60%_at_50%_0%,rgb(0_113_227/0.12),transparent)]"
      />
      <div className="flex items-center justify-between">
        <Link
          href="/"
          className="flex w-fit items-center gap-0.5 rounded-full py-2 pr-3 text-[15px] text-primary transition-opacity hover:opacity-70"
        >
          <ChevronLeft className="size-5" /> {m.common.home}
        </Link>
        <LanguageSwitcher />
      </div>

      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-8">
        <Link href="/" className="mx-auto mb-8 flex flex-col items-center gap-3">
          <span className="flex size-16 items-center justify-center rounded-[27%] bg-primary text-primary-foreground shadow-[0_8px_24px_rgb(0_113_227/0.35)]">
            <ClipboardCheck className="size-8" />
          </span>
          <span className="text-lg font-semibold tracking-tight">{APP_NAME}</span>
        </Link>
        {children}
      </div>
    </div>
  );
}

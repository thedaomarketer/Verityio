"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HelpCircle } from "lucide-react";

import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/client";
import { NAV_ITEMS, SECONDARY_NAV_ITEMS } from "./nav-items";
import { CreateMenu } from "./create-menu";
import { APP_NAME } from "@/lib/brand";
import { BrandMark } from "@/components/brand-mark";

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNav() {
  const pathname = usePathname();
  const { m } = useI18n();

  return (
    <aside className="glass sticky top-0 hidden h-svh w-64 shrink-0 flex-col border-r border-black/[0.06] md:flex">
      <Link href="/dashboard" className="flex h-16 items-center gap-2.5 px-5 text-[17px] font-semibold tracking-tight">
        <BrandMark className="size-8" />
        {APP_NAME}
      </Link>
      <div className="p-3 pb-0">
        <CreateMenu variant="button" />
      </div>
      <nav aria-label={m.nav.primary} className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-3">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors",
              isActive(pathname, item.href)
                ? "bg-primary/10 font-semibold text-primary"
                : "text-foreground/80 hover:bg-black/[0.04]"
            )}
          >
            <item.icon className="size-[18px]" />
            {m.nav[item.label]}
          </Link>
        ))}
      </nav>
      <div className="flex flex-col gap-0.5 border-t border-black/[0.06] p-3">
        {SECONDARY_NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors",
              isActive(pathname, item.href)
                ? "bg-primary/10 font-semibold text-primary"
                : "text-foreground/80 hover:bg-black/[0.04]"
            )}
          >
            <item.icon className="size-[18px]" />
            {m.nav[item.label]}
          </Link>
        ))}
        <Link
          href="/help"
          className="flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium text-foreground/80 transition-colors hover:bg-black/[0.04]"
        >
          <HelpCircle className="size-[18px]" />
          {m.nav.help}
        </Link>
      </div>
    </aside>
  );
}

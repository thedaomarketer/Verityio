import Link from "next/link";
import { Crown, LogOut, Settings, Sparkles, User as UserIcon } from "lucide-react";

import { signOutAction } from "@/lib/actions/auth";
import { getI18n } from "@/lib/i18n/server";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { APP_NAME } from "@/lib/brand";
import { BrandMark } from "@/components/brand-mark";

export function initials(name: string | null, email: string | null): string {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/);
    return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
  }
  return (email ?? "?").slice(0, 2).toUpperCase();
}

export async function Header({
  fullName,
  email,
  avatarVersion,
}: {
  fullName: string | null;
  email: string | null;
  /** The stored photo path; changes when the photo does, so the image URL busts the cache. */
  avatarVersion?: string | null;
}) {
  const { m } = await getI18n();
  return (
    <header className="glass sticky top-0 z-30 flex h-[calc(3.5rem+env(safe-area-inset-top))] shrink-0 items-center justify-between border-b border-black/[0.06] px-4 pt-[env(safe-area-inset-top)] md:px-6">
      <Link href="/dashboard" className="flex items-center gap-2 font-semibold tracking-tight md:hidden">
        <BrandMark className="size-7" />
        {APP_NAME}
      </Link>
      <div className="hidden md:block" />
      <div className="flex items-center gap-1.5">
        {/* The assistant lives behind one icon, always in reach, rather than in the page list. */}
        <Link
          href="/assistant"
          aria-label={m.nav.assistant}
          title={m.nav.assistant}
          className="flex size-10 items-center justify-center rounded-full transition-transform duration-150 hover:scale-105 focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none active:scale-95"
        >
          <span className="flex size-8 items-center justify-center rounded-full bg-[linear-gradient(135deg,#7c5cff_0%,#0071e3_60%,#00b3ff_100%)] text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.3),0_4px_12px_-2px_rgb(76_80_255/0.5)]">
            <Sparkles className="size-4" />
          </span>
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full" aria-label={m.header.accountMenu}>
              <Avatar className="size-8">
                {avatarVersion && <AvatarImage src={`/api/avatar?v=${encodeURIComponent(avatarVersion)}`} alt="" className="object-cover" />}
                <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">{initials(fullName, email)}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-2 py-1.5 text-sm">
              <p className="font-medium">{fullName ?? m.header.yourAccount}</p>
              <p className="truncate text-xs text-muted-foreground">{email}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings">
                <UserIcon /> {m.header.profile}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings">
                <Settings /> {m.header.settings}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/premium">
                <Crown /> {m.nav.premium}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <form action={signOutAction}>
              <DropdownMenuItem asChild variant="destructive">
                <button type="submit" className="w-full">
                  <LogOut /> {m.header.logOut}
                </button>
              </DropdownMenuItem>
            </form>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

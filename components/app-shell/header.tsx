import Link from "next/link";
import { ClipboardCheck, LogOut, Settings, User as UserIcon } from "lucide-react";

import { signOutAction } from "@/lib/actions/auth";
import { getI18n } from "@/lib/i18n/server";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { APP_NAME } from "@/lib/brand";

function initials(name: string | null, email: string | null): string {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/);
    return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
  }
  return (email ?? "?").slice(0, 2).toUpperCase();
}

export async function Header({
  fullName,
  email,
}: {
  fullName: string | null;
  email: string | null;
}) {
  const { m } = await getI18n();
  return (
    <header className="glass sticky top-0 z-30 flex h-[calc(3.5rem+env(safe-area-inset-top))] shrink-0 items-center justify-between border-b border-black/[0.06] px-4 pt-[env(safe-area-inset-top)] md:px-6">
      <Link href="/dashboard" className="flex items-center gap-2 font-semibold tracking-tight md:hidden">
        <span className="flex size-7 items-center justify-center rounded-[8px] bg-primary text-primary-foreground">
          <ClipboardCheck className="size-4" />
        </span>
        {APP_NAME}
      </Link>
      <div className="hidden md:block" />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="rounded-full" aria-label={m.header.accountMenu}>
            <Avatar className="size-8">
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
    </header>
  );
}

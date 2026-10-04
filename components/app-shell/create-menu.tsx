"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { BookText, Car, Clock, Plus, Receipt, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/client";
import type { Messages } from "@/lib/i18n/messages/en";

type CreateMessageKey = keyof Messages["createMenu"];

interface CreateAction {
  href: string;
  label: CreateMessageKey;
  description: CreateMessageKey;
  icon: LucideIcon;
  /** Literal Tailwind classes for the card's gradient (white text clears AA on every stop). */
  cardClassName: string;
}

/**
 * Only the things people record every day. Less frequent actions (adding a
 * job) live on their own pages, so the carousel stays short and scannable.
 */
const CREATE_ACTIONS: CreateAction[] = [
  {
    href: "/time?new=shift",
    label: "logShift",
    description: "logShiftDescription",
    icon: Clock,
    cardClassName: "bg-[linear-gradient(150deg,#2f8cff_0%,#0058c4_100%)]",
  },
  {
    href: "/expenses?new=1",
    label: "addExpense",
    description: "addExpenseDescription",
    icon: Receipt,
    cardClassName: "bg-[linear-gradient(150deg,#2fa152_0%,#1b6e33_100%)]",
  },
  {
    href: "/mileage?new=1",
    label: "addMileage",
    description: "addMileageDescription",
    icon: Car,
    cardClassName: "bg-[linear-gradient(150deg,#e2561a_0%,#a83300_100%)]",
  },
  {
    href: "/journal?new=1",
    label: "journalEntry",
    description: "journalEntryDescription",
    icon: BookText,
    cardClassName: "bg-[linear-gradient(150deg,#9a5bc4_0%,#6a2f94_100%)]",
  },
];

/**
 * The quick-create entry point: a floating action button on mobile (in
 * `MobileNav`), a plain button on desktop (in `SidebarNav`). Both open the
 * same sheet: a swipeable, snap-scrolling carousel of shortcut cards, each
 * deep-linking to the page that already owns the relevant create dialog (via
 * a `?new=` param the dialog reads on mount) rather than duplicating any of
 * that form/validation logic here.
 */
export function CreateMenu({ variant }: { variant: "fab" | "button" }) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(0);
  const scroller = useRef<HTMLDivElement>(null);
  const { m } = useI18n();

  function onScroll() {
    const el = scroller.current;
    const first = el?.firstElementChild as HTMLElement | null;
    if (!el || !first) return;
    const step = first.offsetWidth + 12; // card width + gap-3
    setPage(Math.min(CREATE_ACTIONS.length - 1, Math.max(0, Math.round(el.scrollLeft / step))));
  }

  function scrollTo(index: number) {
    const card = scroller.current?.children[index] as HTMLElement | undefined;
    card?.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setPage(0);
      }}
    >
      <SheetTrigger asChild>
        {variant === "fab" ? (
          <button
            type="button"
            aria-label={m.createMenu.create}
            className="flex size-14 -translate-y-3 items-center justify-center rounded-full bg-[linear-gradient(150deg,#3b9bff_0%,#0071e3_50%,#0a4fb0_100%)] text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.35),0_8px_20px_rgb(0_113_227/0.45)] ring-4 ring-background transition-transform duration-150 active:scale-90"
          >
            <Plus className="size-7" strokeWidth={2.5} />
          </button>
        ) : (
          <Button className="w-full">
            <Plus /> {m.createMenu.create}
          </Button>
        )}
      </SheetTrigger>
      <SheetContent side="bottom" className="mx-auto max-w-xl pb-[max(1.25rem,env(safe-area-inset-bottom))] md:rounded-t-3xl">
        <SheetHeader className="px-5 pt-1 pb-0">
          <SheetTitle className="text-xl font-bold tracking-tight">{m.createMenu.title}</SheetTitle>
          <SheetDescription>{m.createMenu.description}</SheetDescription>
        </SheetHeader>

        <div
          ref={scroller}
          onScroll={onScroll}
          role="list"
          className="no-scrollbar flex snap-x snap-mandatory scroll-px-5 gap-3 overflow-x-auto px-5 pt-1 pb-2"
        >
          {CREATE_ACTIONS.map((action) => (
            <Link
              key={action.href}
              role="listitem"
              href={action.href}
              onClick={() => setOpen(false)}
              className={cn(
                "flex h-40 w-[42%] min-w-[9.5rem] shrink-0 snap-start flex-col justify-between rounded-3xl p-4 text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.25),0_10px_24px_-12px_rgb(0_0_0/0.45)] transition-transform duration-150 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/60 active:scale-[0.97] sm:w-[30%]",
                action.cardClassName
              )}
            >
              <span className="flex size-10 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
                <action.icon className="size-5" />
              </span>
              <span>
                <span className="block text-[15px] leading-tight font-semibold">{m.createMenu[action.label]}</span>
                <span className="mt-0.5 line-clamp-2 block text-xs leading-snug text-white/85">
                  {m.createMenu[action.description]}
                </span>
              </span>
            </Link>
          ))}
        </div>

        {/* Page dots: decorative position hints that also jump to a card. */}
        <div className="flex justify-center gap-1.5 pt-1">
          {CREATE_ACTIONS.map((action, i) => (
            <button
              key={action.href}
              type="button"
              tabIndex={-1}
              aria-hidden="true"
              onClick={() => scrollTo(i)}
              className={cn(
                "h-1.5 rounded-full transition-all duration-200",
                i === page ? "w-4 bg-foreground/70" : "w-1.5 bg-foreground/20"
              )}
            />
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}

"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, ChevronRight, Flag, LayoutGrid, List, Rows3 } from "lucide-react";

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

export interface CalendarItem {
  id: string;
  label: string;
  /** "9:00 AM – 5:00 PM", or "" for all-day items. */
  time: string;
  color: string;
  kind: "worked" | "active" | "scheduled" | "holiday";
  /** Paid time for worked shifts, pre-formatted ("7h 30m"). */
  duration?: string;
}

export interface CalendarDay {
  items: CalendarItem[];
  /** Paid hours worked that day, pre-formatted, if any. */
  worked?: string;
}

type View = "compact" | "details" | "list";
const VIEW_KEY = "workledger:calendar-view";
const VIEW_EVENT = "workledger:calendar-view";

/** The saved view, a per-device display preference (falls back to Compact without storage). */
function readView(): View {
  try {
    const saved = window.localStorage.getItem(VIEW_KEY);
    if (saved === "compact" || saved === "details" || saved === "list") return saved;
  } catch {
    // Storage unavailable (private mode).
  }
  return "compact";
}

function subscribeView(onChange: () => void) {
  window.addEventListener(VIEW_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(VIEW_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/**
 * iOS-Calendar-style month: a grid with a dot (or, in Details, a bar) per
 * job on each day, today in a red circle, the selected day's shifts listed
 * underneath, and a List view for the whole month. Selecting a day is
 * instant (client state); months change through links so the server loads
 * that month's data.
 */
export function MonthCalendar({
  monthTitle,
  yearTitle,
  weekdayLabels,
  weekendColumns,
  leadingBlanks,
  dates,
  dayLabels,
  days,
  today,
  initialSelected,
  prevHref,
  nextHref,
  todayHref,
}: {
  monthTitle: string;
  yearTitle: string;
  weekdayLabels: string[];
  /** Column indexes (0-6) that fall on a weekend, shown dimmed. */
  weekendColumns: number[];
  leadingBlanks: number;
  /** Every date in the month, YYYY-MM-DD. */
  dates: string[];
  /** Long label per date for the list headings, e.g. "Sunday, October 4". */
  dayLabels: Record<string, string>;
  days: Record<string, CalendarDay>;
  today: string;
  initialSelected: string;
  prevHref: string;
  nextHref: string;
  todayHref: string;
}) {
  const { m } = useI18n();
  const router = useRouter();
  // Remounted per month (see the page's `key`), so the initial selection always matches the month shown.
  const [selected, setSelected] = useState(initialSelected);
  const view = useSyncExternalStore(subscribeView, readView, () => "compact" as View);

  function chooseView(next: View) {
    try {
      window.localStorage.setItem(VIEW_KEY, next);
    } catch {
      // Ignore: the choice just won't be remembered.
    }
    window.dispatchEvent(new Event(VIEW_EVENT));
  }

  function goToday() {
    if (dates.includes(today)) setSelected(today);
    else router.push(todayHref);
  }

  const views: { id: View; label: string; icon: typeof LayoutGrid }[] = [
    { id: "compact", label: m.calendar.views.compact, icon: LayoutGrid },
    { id: "details", label: m.calendar.views.details, icon: Rows3 },
    { id: "list", label: m.calendar.views.list, icon: List },
  ];
  const selectedDay = days[selected];
  const listDates = dates.filter((d) => (days[d]?.items.length ?? 0) > 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-primary">{yearTitle}</p>
          <h1 className="text-[32px] leading-tight font-bold tracking-tight">{monthTitle}</h1>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={goToday}
            className="flex min-h-11 items-center rounded-full bg-card px-4 text-[15px] font-medium shadow-[0_1px_3px_rgb(0_0_0/0.08)] transition-transform active:scale-95"
          >
            {m.calendar.today}
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={m.calendar.viewOptions}
              className="flex size-11 items-center justify-center rounded-full bg-card shadow-[0_1px_3px_rgb(0_0_0/0.08)] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
            >
              {(() => {
                const Icon = views.find((v) => v.id === view)!.icon;
                return <Icon className="size-[18px]" />;
              })()}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {views.map((v) => (
                <DropdownMenuItem key={v.id} onSelect={() => chooseView(v.id)} className="min-h-11 gap-3 text-[15px]">
                  <span className="w-4">{view === v.id && <Check className="size-4" />}</span>
                  <v.icon className="size-4" />
                  {v.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Link
            href={prevHref}
            aria-label={m.calendar.previousMonth}
            className="flex size-11 items-center justify-center rounded-full text-primary hover:bg-accent"
          >
            <ChevronLeft className="size-5" />
          </Link>
          <Link
            href={nextHref}
            aria-label={m.calendar.nextMonth}
            className="flex size-11 items-center justify-center rounded-full text-primary hover:bg-accent"
          >
            <ChevronRight className="size-5" />
          </Link>
        </div>
      </div>

      {view === "list" ? (
        <div className="overflow-hidden rounded-2xl bg-card">
          {listDates.length === 0 ? (
            <p className="py-16 text-center text-lg font-semibold text-muted-foreground">{m.calendar.noEvents}</p>
          ) : (
            listDates.map((date) => (
              <section key={date} className="border-b border-black/[0.06] last:border-0">
                <h2
                  className={cn(
                    "sticky top-[calc(3.5rem+env(safe-area-inset-top))] bg-card/95 px-4 pt-3 pb-1 text-sm font-semibold backdrop-blur",
                    date === today && "text-destructive"
                  )}
                >
                  {dayLabels[date]}
                </h2>
                <DayItems items={days[date].items} />
              </section>
            ))
          )}
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-2xl bg-card">
            <div className="grid grid-cols-7 border-b border-black/[0.06] py-2 text-center text-xs font-medium">
              {weekdayLabels.map((label, i) => (
                <span key={i} className={weekendColumns.includes(i) ? "text-muted-foreground" : ""} aria-hidden="true">
                  {label}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-7" role="grid" aria-label={`${monthTitle} ${yearTitle}`}>
              {Array.from({ length: leadingBlanks }, (_, i) => (
                <span key={`blank-${i}`} className="border-b border-black/[0.06]" aria-hidden="true" />
              ))}
              {dates.map((date, i) => {
                const column = (leadingBlanks + i) % 7;
                const day = days[date];
                const isToday = date === today;
                const isSelected = date === selected;
                const jobColors = [...new Set((day?.items ?? []).filter((it) => it.kind !== "holiday").map((it) => it.color))].slice(0, 3);
                const holiday = day?.items.some((it) => it.kind === "holiday");
                return (
                  <button
                    key={date}
                    type="button"
                    role="gridcell"
                    aria-selected={isSelected}
                    aria-label={`${dayLabels[date]}${day?.items.length ? `, ${day.items.length}` : ""}`}
                    onClick={() => setSelected(date)}
                    className={cn(
                      "flex flex-col items-center gap-1 border-b border-black/[0.06] pt-1.5 pb-1 outline-none focus-visible:bg-accent",
                      view === "details" ? "min-h-[4.75rem]" : "min-h-14"
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-8 items-center justify-center rounded-full text-[17px] tabular-nums",
                        isToday && "bg-destructive font-semibold text-white",
                        !isToday && isSelected && "bg-foreground font-semibold text-background",
                        !isToday && !isSelected && weekendColumns.includes(column) && "text-muted-foreground"
                      )}
                    >
                      {Number(date.slice(8, 10))}
                    </span>
                    {view === "compact" ? (
                      <span className="flex h-1.5 items-center gap-0.5" aria-hidden="true">
                        {jobColors.map((color) => (
                          <span key={color} className="size-1.5 rounded-full" style={{ backgroundColor: color }} />
                        ))}
                        {holiday && <span className="size-1.5 rounded-full bg-success" />}
                      </span>
                    ) : (
                      <span className="flex w-full flex-col gap-0.5 px-0.5" aria-hidden="true">
                        {holiday && <span className="h-1 rounded-full bg-success" />}
                        {jobColors.map((color) => (
                          <span key={color} className="h-1 rounded-full" style={{ backgroundColor: color }} />
                        ))}
                        {day?.worked && <span className="truncate text-center text-[10px] leading-tight text-muted-foreground tabular-nums">{day.worked}</span>}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <section aria-live="polite" className="overflow-hidden rounded-2xl bg-card">
            <h2 className={cn("px-4 pt-3 pb-1 text-sm font-semibold", selected === today && "text-destructive")}>
              {dayLabels[selected]}
              {selectedDay?.worked && <span className="font-normal text-muted-foreground"> · {fmt(m.calendar.workedTotal, { hours: selectedDay.worked })}</span>}
            </h2>
            {selectedDay?.items.length ? (
              <DayItems items={selectedDay.items} />
            ) : (
              <p className="pt-10 pb-12 text-center text-lg font-semibold text-muted-foreground">{m.calendar.noEvents}</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function DayItems({ items }: { items: CalendarItem[] }) {
  const { m } = useI18n();
  const badge: Record<CalendarItem["kind"], string> = {
    worked: m.calendar.worked,
    active: m.calendar.workingNow,
    scheduled: m.calendar.scheduled,
    holiday: m.holidays.holiday,
  };
  return (
    <ul className="pb-1">
      {items.map((item) => (
        <li key={item.id} className="flex items-center gap-3 px-4 py-2.5">
          {item.kind === "holiday" ? (
            <Flag className="size-4 shrink-0 text-success" aria-hidden="true" />
          ) : (
            <span
              className={cn("h-9 w-1 shrink-0 rounded-full", item.kind === "scheduled" && "opacity-50")}
              style={{ backgroundColor: item.color }}
              aria-hidden="true"
            />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-medium">{item.label}</p>
            <p className="text-xs text-muted-foreground">
              {item.time || m.calendar.allDay}
              {item.duration && ` · ${item.duration}`}
            </p>
          </div>
          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold",
              item.kind === "active" && "bg-success/15 text-[#1b6e33]",
              item.kind === "worked" && "bg-secondary text-muted-foreground",
              item.kind === "scheduled" && "bg-primary/10 text-primary",
              item.kind === "holiday" && "bg-success/10 text-[#1b6e33]"
            )}
          >
            {badge[item.kind]}
          </span>
        </li>
      ))}
    </ul>
  );
}

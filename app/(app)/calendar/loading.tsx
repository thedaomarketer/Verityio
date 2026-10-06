import { Skeleton } from "@/components/ui/skeleton";

/** Same shape as the calendar (title, toolbar, month grid, day list) so loading doesn't jump the layout. */
export default function CalendarLoading() {
  return (
    <div className="space-y-4" aria-busy="true">
      <div className="flex items-center justify-between gap-2">
        <div className="space-y-2">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-9 w-40" />
        </div>
        <div className="flex items-center gap-1">
          <Skeleton className="h-11 w-20 rounded-full" />
          <Skeleton className="size-11 rounded-full" />
          <Skeleton className="size-11 rounded-full" />
          <Skeleton className="size-11 rounded-full" />
        </div>
      </div>
      <div className="overflow-hidden rounded-2xl bg-card">
        <div className="h-9 border-b border-black/[0.06]" />
        <div className="grid grid-cols-7">
          {Array.from({ length: 35 }, (_, i) => (
            <div key={i} className="flex min-h-14 flex-col items-center gap-1 border-b border-black/[0.06] pt-1.5">
              <Skeleton className="size-8 rounded-full" />
            </div>
          ))}
        </div>
      </div>
      <Skeleton className="h-36 w-full rounded-2xl" />
    </div>
  );
}

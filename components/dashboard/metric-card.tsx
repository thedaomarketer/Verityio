import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function MetricCard({
  label,
  value,
  sub,
  href,
}: {
  label: string;
  value: string;
  sub?: string;
  /** Makes the whole card a link to the page with the detail behind the number. */
  href?: string;
}) {
  const card = (
    <Card className={cn("h-full gap-1.5", href && "transition-colors group-hover:bg-accent/40 group-active:bg-black/[0.03]")}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2 text-sm font-normal text-muted-foreground">
          {label}
          {href && <ChevronRight className="size-4 shrink-0 text-muted-foreground/50" aria-hidden="true" />}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-[26px] leading-tight font-bold tracking-tight tabular-nums">{value}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );

  return href ? (
    <Link href={href} className="group block rounded-2xl focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none">
      {card}
    </Link>
  ) : (
    card
  );
}

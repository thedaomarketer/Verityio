import Link from "next/link";

import { GRANULARITIES, type Granularity } from "@/lib/calculations";
import { cn } from "@/lib/utils";

/**
 * Daily / Weekly / Monthly / Yearly switch, as links (works without
 * JavaScript and keeps the choice in the URL). `query` is the current range.
 */
export function GranularityTabs({
  basePath,
  query,
  current,
  labels,
  label,
}: {
  basePath: string;
  query: string;
  current: Granularity;
  labels: Record<Granularity, string>;
  label: string;
}) {
  return (
    <nav aria-label={label} className="print-hidden inline-flex rounded-full bg-secondary p-0.5">
      {GRANULARITIES.map((g) => (
        <Link
          key={g}
          href={`${basePath}?${query}&by=${g}`}
          scroll={false}
          aria-current={g === current ? "true" : undefined}
          className={cn(
            "flex min-h-8 items-center rounded-full px-3 text-[13px] font-medium transition-colors",
            g === current ? "bg-card text-foreground shadow-[0_1px_3px_rgb(0_0_0/0.12)]" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {labels[g]}
        </Link>
      ))}
    </nav>
  );
}

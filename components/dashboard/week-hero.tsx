import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { Amount, AmountsToggle } from "@/components/privacy/amounts-visibility";

/**
 * The dashboard's lead card: this week's estimated earnings as the hero
 * number, with the hours behind it. Values arrive pre-formatted; the
 * "estimated" wording comes from the caller so it can never be dropped.
 */
export function WeekHero({
  title,
  earnings,
  earningsLabel,
  stats,
  href,
  linkLabel,
}: {
  title: string;
  earnings: string;
  earningsLabel: string;
  stats: { label: string; value: string }[];
  href: string;
  linkLabel: string;
}) {
  return (
    <section className="hero-surface relative overflow-hidden rounded-3xl p-5 shadow-[0_18px_40px_-18px_rgb(10_30_80/0.55)] md:p-6">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-sm font-medium text-white/75">{title}</h2>
        <div className="-mt-2.5 -mr-2 flex items-center">
          <AmountsToggle tone="dark" />
          <Link
            href={href}
            className="flex min-h-11 items-center gap-0.5 rounded-full px-3 text-xs font-semibold text-white/90 transition-colors hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none"
          >
            {linkLabel}
            <ChevronRight className="size-3.5" aria-hidden="true" />
          </Link>
        </div>
      </div>
      <p className="mt-1 text-[40px] leading-none font-bold tracking-tight tabular-nums md:text-5xl">
        <Amount value={earnings} />
      </p>
      <p className="mt-1.5 text-xs text-white/70">{earningsLabel}</p>
      <dl className="mt-5 grid grid-cols-3 gap-2 border-t border-white/15 pt-4">
        {stats.map((stat) => (
          <div key={stat.label} className="min-w-0">
            <dt className="truncate text-xs text-white/70">{stat.label}</dt>
            <dd className="mt-0.5 text-lg leading-tight font-semibold tabular-nums">{stat.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

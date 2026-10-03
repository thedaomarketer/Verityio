"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, Download, FileSpreadsheet, HeartHandshake, Landmark, Receipt, ShieldCheck, Wallet, type LucideIcon } from "lucide-react";

import { RESOURCE_CATEGORIES, RESOURCE_LINKS, type ResourceCategory, type ResourceCountry } from "@/lib/resources";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

const CATEGORY_STYLE: Record<ResourceCategory, { icon: LucideIcon; tile: string }> = {
  taxes: { icon: Landmark, tile: "bg-[#5856d6]" },
  pay: { icon: Wallet, tile: "bg-[#248a3d]" },
  benefits: { icon: HeartHandshake, tile: "bg-[#0071e3]" },
  safety: { icon: ShieldCheck, tile: "bg-[#c93400]" },
};

export function ResourcesBrowser({ defaultCountry }: { defaultCountry: ResourceCountry }) {
  const { m } = useI18n();
  const r = m.resources;
  const [country, setCountry] = useState<ResourceCountry>(defaultCountry);

  return (
    <div className="space-y-8">
      <div role="radiogroup" aria-label={r.country} className="inline-flex gap-1 rounded-full bg-muted p-1">
        {(["CA", "US"] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={country === value}
            onClick={() => setCountry(value)}
            className={cn(
              "min-h-10 rounded-full px-4 text-sm font-medium transition-colors",
              country === value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {value === "CA" ? r.canada : r.unitedStates}
          </button>
        ))}
      </div>

      <section aria-labelledby="tax-time" className="rounded-3xl bg-card p-5 shadow-[0_1px_2px_rgb(0_0_0/0.04)] sm:p-6">
        <h2 id="tax-time" className="text-lg font-semibold tracking-tight">
          {r.taxTimeTitle}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{r.taxTimeBody}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/reports" className="inline-flex min-h-10 items-center gap-2 rounded-full bg-secondary px-4 text-sm font-semibold text-primary transition-transform active:scale-95">
            <FileSpreadsheet className="size-4" aria-hidden="true" /> {r.taxTimeReports}
          </Link>
          <Link href="/taxes" className="inline-flex min-h-10 items-center gap-2 rounded-full bg-secondary px-4 text-sm font-semibold text-primary transition-transform active:scale-95">
            <Receipt className="size-4" aria-hidden="true" /> {r.taxTimeTaxes}
          </Link>
          <a href="/api/account/export" className="inline-flex min-h-10 items-center gap-2 rounded-full bg-secondary px-4 text-sm font-semibold text-primary transition-transform active:scale-95">
            <Download className="size-4" aria-hidden="true" /> {r.taxTimeExport}
          </a>
        </div>
      </section>

      {RESOURCE_CATEGORIES.map((category) => {
        const links = RESOURCE_LINKS.filter((link) => link.country === country && link.category === category);
        if (links.length === 0) return null;
        const { icon: Icon, tile } = CATEGORY_STYLE[category];
        return (
          <section key={category} aria-labelledby={`resources-${category}`} className="space-y-3">
            <h2 id={`resources-${category}`} className="flex items-center gap-2.5 text-base font-semibold tracking-tight">
              <span className={cn("flex size-7 items-center justify-center rounded-[8px] text-white", tile)}>
                <Icon className="size-4" aria-hidden="true" />
              </span>
              {r.categories[category]}
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {links.map((link) => {
                const item = r.items[link.id];
                return (
                  <li key={link.id}>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex h-full items-start gap-3 rounded-2xl bg-card p-4 shadow-[0_1px_2px_rgb(0_0_0/0.04)] transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgb(0_0_0/0.08)] focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none active:scale-[0.99]"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold">{item.title}</span>
                        <span className="mt-0.5 block text-sm text-muted-foreground">{item.body}</span>
                        <span className="mt-2 block truncate text-xs text-muted-foreground/80">{new URL(link.url).hostname}</span>
                      </span>
                      <ArrowUpRight
                        className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary"
                        aria-hidden="true"
                      />
                      <span className="sr-only">({r.opensInNewTab})</span>
                    </a>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      <p className="text-xs text-muted-foreground">{r.disclaimer}</p>
    </div>
  );
}

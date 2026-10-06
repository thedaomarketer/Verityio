"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";

import { HIDE_AMOUNTS_COOKIE, MASKED_AMOUNT } from "@/lib/privacy";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

interface AmountsVisibility {
  hidden: boolean;
  toggle: () => void;
}

const AmountsVisibilityContext = createContext<AmountsVisibility | null>(null);

/** Wraps the signed-in app; `initialHidden` comes from the cookie on the server. */
export function AmountsVisibilityProvider({ initialHidden, children }: { initialHidden: boolean; children: ReactNode }) {
  const [hidden, setHidden] = useState(initialHidden);

  function toggle() {
    const next = !hidden;
    setHidden(next);
    // A display preference, not a credential: readable cookie, one year, this site only.
    document.cookie = next
      ? `${HIDE_AMOUNTS_COOKIE}=1; path=/; max-age=31536000; samesite=lax`
      : `${HIDE_AMOUNTS_COOKIE}=; path=/; max-age=0; samesite=lax`;
  }

  return <AmountsVisibilityContext.Provider value={{ hidden, toggle }}>{children}</AmountsVisibilityContext.Provider>;
}

function useAmountsVisibility(): AmountsVisibility {
  // Outside the provider (e.g. a public page) amounts simply show.
  return useContext(AmountsVisibilityContext) ?? { hidden: false, toggle: () => {} };
}

/** Whether "Hide balances" is on -- for inputs and other places `Amount` can't wrap. */
export function useAmountsHidden(): boolean {
  return useAmountsVisibility().hidden;
}

/** A money figure that respects "Hide balances". Pass the already-formatted string. */
export function Amount({ value, className }: { value: string; className?: string }) {
  const { hidden } = useAmountsVisibility();
  const { m } = useI18n();
  if (!hidden) return <span className={className}>{value}</span>;
  return (
    <span className={cn("tracking-widest", className)} aria-label={m.privacy.hiddenAmount}>
      <span aria-hidden="true">{MASKED_AMOUNT}</span>
    </span>
  );
}

/** Eye button that hides or shows every amount on the screen at once. */
export function AmountsToggle({ tone = "light", className }: { tone?: "light" | "dark"; className?: string }) {
  const { hidden, toggle } = useAmountsVisibility();
  const { m } = useI18n();
  const label = hidden ? m.privacy.showBalances : m.privacy.hideBalances;
  const Icon = hidden ? EyeOff : Eye;
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={hidden}
      aria-label={label}
      title={label}
      className={cn(
        "flex size-11 shrink-0 items-center justify-center rounded-full transition-colors outline-none focus-visible:ring-2",
        tone === "dark"
          ? "text-white/85 hover:bg-white/10 focus-visible:ring-white/70"
          : "text-muted-foreground hover:bg-accent focus-visible:ring-ring/40",
        className
      )}
    >
      <Icon className="size-[18px]" aria-hidden="true" />
    </button>
  );
}

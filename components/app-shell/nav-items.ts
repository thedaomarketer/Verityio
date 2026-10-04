import type { LucideIcon } from "lucide-react";

import type { Messages } from "@/lib/i18n/messages/en";
import {
  BookText,
  CalendarDays,
  Clock,
  LayoutDashboard,
  Briefcase,
  Car,
  Receipt,
  Wallet,
  Crown,
  BarChart3,
  Landmark,
  Settings,
  LifeBuoy,
} from "lucide-react";

export interface NavItem {
  href: string;
  /** Key into `m.nav`; resolved with `useI18n()` where rendered. */
  label: keyof Messages["nav"];
  /** Shorter label for the mobile tab bar, when the full one doesn't fit. */
  tabLabel?: keyof Messages["nav"];
  icon: LucideIcon;
  /**
   * Shown in the mobile tab bar. Keep exactly three flagged: with the "More"
   * tab that makes four, split two either side of the centered "+" button.
   */
  mobile?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "dashboard", tabLabel: "dashboardTab", icon: LayoutDashboard, mobile: true },
  { href: "/time", label: "time", icon: Clock, mobile: true },
  { href: "/calendar", label: "calendar", icon: CalendarDays },
  { href: "/jobs", label: "jobs", icon: Briefcase },
  { href: "/journal", label: "journal", icon: BookText },
  { href: "/expenses", label: "expenses", icon: Receipt },
  { href: "/mileage", label: "mileage", icon: Car },
  { href: "/budget", label: "budget", icon: Wallet },
  { href: "/reports", label: "reports", icon: BarChart3, mobile: true },
  { href: "/taxes", label: "taxes", icon: Landmark },
  { href: "/resources", label: "resources", icon: LifeBuoy },
];

export const SECONDARY_NAV_ITEMS: NavItem[] = [
  { href: "/premium", label: "premium", icon: Crown },
  { href: "/settings", label: "settings", icon: Settings },
];

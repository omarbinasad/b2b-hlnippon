import type { Route } from "next";
import { STORE_CURRENCY } from "./currency";

/**
 * Brand and store settings — the single place to change the store name,
 * logo, contact details, and locale defaults. Brand colors live in
 * `src/app/globals.css` (the `--brand-*` variables).
 *
 * Locale values are mock defaults; the backend's store settings will own them later.
 */
export const siteConfig = {
  name: "Wholesale Store",
  shortName: "Store",
  tagline: "Wholesale food supply for businesses across Japan",
  description: "B2B wholesale ordering for restaurants, grocers and distributors across Japan.",
  /**
   * Logo files in /public/brand: `light` (dark text) shows in light theme, `dark` (white text)
   * in dark theme and on the always-dark admin sidebar. Set both to null for the text placeholder.
   */
  logo: { light: "/brand/hl-logo-on-light.webp" as string | null, dark: "/brand/hl-logo-on-dark.webp" as string | null, width: 922, height: 266 },
  contact: {
    email: "info@example.com",
    phone: "03-0000-0000",
    address: "Placeholder address, Tokyo, Japan",
    hours: "Mon–Fri 9:00–18:00",
  },
  country: "JP",
  /** From src/config/currency.ts (also read by the calculation engines). */
  currency: STORE_CURRENCY.code,
  currencySymbol: STORE_CURRENCY.symbol,
  /** Number grouping (1,234,567). */
  numberLocale: "ja-JP",
  dateLocale: "en-GB",
  timeZone: "Asia/Tokyo",
  /** Fixed UTC offset of the store time zone (Japan has no daylight saving), for date-only values. */
  utcOffset: "+09:00",
  /** First day of the week in date pickers: 0 = Sunday … 6 = Saturday. */
  weekStartsOn: 0 as 0 | 1 | 2 | 3 | 4 | 5 | 6,
} as const;

export type IconName =
  | "dashboard"
  | "box"
  | "clipboard"
  | "user"
  | "users"
  | "tag"
  | "truck"
  | "bell"
  | "settings"
  | "folder"
  | "fileUser";

export interface NavItem {
  href: Route;
  label: string;
  icon?: IconName;
}

export const storeNav: NavItem[] = [
  { href: "/shop", label: "Product catalog" },
  { href: "/#quick-order" as Route, label: "Quick order" },
  { href: "/#delivery" as Route, label: "Delivery information" },
  { href: "/about", label: "About us" },
  { href: "/contact", label: "Contact" },
];

/** Single place for the B2B application call to action (shown in the store header). */
export const applyCta: NavItem = { href: "/register", label: "Apply for B2B account" };

export const accountNav: NavItem[] = [
  { href: "/account", label: "Dashboard" },
  { href: "/account/quick-order", label: "Quick order" },
  { href: "/account/orders", label: "Orders" },
  { href: "/account/addresses", label: "Addresses" },
  { href: "/account/notifications", label: "Notifications" },
  { href: "/account/profile", label: "Profile" },
];

export const adminNav: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: "dashboard" },
  { href: "/admin/products", label: "Products", icon: "box" },
  { href: "/admin/categories", label: "Categories", icon: "folder" },
  { href: "/admin/orders", label: "Orders", icon: "clipboard" },
  { href: "/admin/customers", label: "Customers", icon: "user" },
  { href: "/admin/customers/requests", label: "Registration requests", icon: "fileUser" },
  { href: "/admin/customer-groups", label: "Customer groups", icon: "users" },
  { href: "/admin/pricing", label: "Pricing rules", icon: "tag" },
  { href: "/admin/shipping", label: "Shipping", icon: "truck" },
  { href: "/admin/tax", label: "Tax", icon: "tag" },
  { href: "/admin/payments", label: "Payments", icon: "settings" },
  { href: "/admin/delivery", label: "Delivery routes", icon: "truck" },
  { href: "/admin/reminders", label: "Reminders", icon: "bell" },
  { href: "/admin/settings", label: "Settings", icon: "settings" },
];

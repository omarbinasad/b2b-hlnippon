import type { Route } from "next";
import type { IconName } from "@/components/ui/icons";
import type { CompanyAddress } from "@/lib/types";
import { STORE_CURRENCY } from "./currency";
import { company } from "./runtime";

/** Display line for the company address. */
const addressLine = (a: CompanyAddress) => [a.addressLine1, a.addressLine2, a.area, a.city, a.prefecture, a.postalCode].filter(Boolean).join(", ");

/** UTC offset of the store time zone right now, e.g. "+09:00", for date-only values. */
function offsetOf(timeZone: string) {
  const part = new Intl.DateTimeFormat("en", { timeZone, timeZoneName: "longOffset" }).formatToParts(new Date()).find((p) => p.type === "timeZoneName")?.value;
  return part?.replace("GMT", "") || "+00:00";
}

/**
 * Brand and store settings, read live from the company settings (`src/config/runtime.ts`). Every value is a getter, so
 * read it when rendering, not at module level. Default values live in `src/config/sample-company.ts`.
 */
export const siteConfig = {
  get name() { return company().storeName; },
  get shortName() { return company().storeName; },
  get companyName() { return company().companyName; },
  get legalName() { return company().legalName; },
  get registrationNumber() { return company().registrationNumber; },
  get tagline() { return company().tagline ?? ""; },
  get description() { return company().description ?? ""; },
  get logo() { return company().branding; },
  get contact() {
    const { address, ...c } = company().contact;
    return { ...c, address: addressLine(address), addressParts: address };
  },
  get country() { return company().locale.country; },
  get currency() { return STORE_CURRENCY.code; },
  get currencySymbol() { return STORE_CURRENCY.symbol; },
  /** Number grouping (1,234,567). */
  get numberLocale() { return company().locale.numberLocale; },
  get dateLocale() { return company().locale.dateLocale; },
  get timeZone() { return company().locale.timeZone; },
  get utcOffset() { return offsetOf(company().locale.timeZone); },
  /** First day of the week in date pickers: 0 = Sunday … 6 = Saturday. */
  get weekStartsOn() { return company().locale.weekStartsOn; },
};


export interface NavItem {
  href: Route;
  label: string;
  icon?: IconName;
}

/** Single place for the B2B application call to action (shown in the store header). */
export const applyCta: NavItem = { href: "/register", label: "Apply for B2B account" };

export const accountNav: NavItem[] = [
  { href: "/account", label: "Dashboard" },
  { href: "/account/quick-order", label: "Quick order" },
  { href: "/account/orders", label: "Orders" },
  { href: "/account/lists", label: "Saved lists" },
  { href: "/account/quotations", label: "Quotations" },
  { href: "/account/invoices", label: "Invoices" },
  { href: "/account/deliveries", label: "Deliveries" },
  { href: "/account/addresses", label: "Addresses" },
  { href: "/account/notifications", label: "Notifications" },
  { href: "/account/profile", label: "Profile" },
];

export interface NavGroup {
  label: string;
  items: NavItem[];
}

/** Admin sidebar. Screens planned in later batches join these groups as they are built. */
export const adminNavGroups: NavGroup[] = [
  { label: "Overview", items: [{ href: "/admin", label: "Dashboard", icon: "dashboard" }] },
  {
    label: "Commerce",
    items: [
      { href: "/admin/orders", label: "Orders", icon: "clipboard" },
      { href: "/admin/orders/new", label: "Create order", icon: "plus" },
      { href: "/admin/quotations", label: "Quotations", icon: "receipt" },
      { href: "/admin/products", label: "Products", icon: "box" },
      { href: "/admin/categories", label: "Categories", icon: "folder" },
      { href: "/admin/brands", label: "Brands", icon: "tag" },
      { href: "/admin/inventory", label: "Inventory", icon: "archive" },
      { href: "/admin/customers", label: "Customers", icon: "user" },
      { href: "/admin/customers/requests", label: "All Requests", icon: "fileUser" },
      { href: "/admin/customer-groups", label: "Customer groups", icon: "users" },
      { href: "/admin/pricing", label: "Pricing rules", icon: "tag" },
      { href: "/admin/coupons", label: "Coupons", icon: "percent" },
    ],
  },
  {
    label: "Website content",
    items: [
      { href: "/admin/pages", label: "Pages", icon: "file" },
      { href: "/admin/posts", label: "Posts", icon: "pencil" },
      { href: "/admin/media", label: "Media library", icon: "image" },
      { href: "/admin/menus", label: "Navigation menus", icon: "menu" },
      { href: "/admin/homepage", label: "Homepage builder", icon: "store" },
    ],
  },
  {
    label: "Shipping & delivery",
    items: [
      { href: "/admin/shipping", label: "Shipping", icon: "truck" },
      { href: "/admin/delivery", label: "Delivery schedules", icon: "calendar" },
    ],
  },
  {
    label: "Notifications",
    items: [
      { href: "/admin/reminders", label: "Reminder campaigns", icon: "bell" },
      { href: "/admin/emails", label: "Email templates", icon: "mail" },
      { href: "/admin/emails/logs", label: "Email logs", icon: "clipboard" },
    ],
  },
  {
    label: "Reports",
    items: [{ href: "/admin/reports", label: "Reports", icon: "chart" }],
  },
  {
    label: "Staff & permissions",
    items: [
      { href: "/admin/staff", label: "Staff", icon: "users" },
      { href: "/admin/roles", label: "Roles", icon: "shieldCheck" },
    ],
  },
  {
    label: "Settings",
    items: [
      { href: "/admin/settings", label: "Settings", icon: "settings" },
      // Only shown to a role that can't open Settings, where this is otherwise a tab.
      { href: "/admin/settings/invoices", label: "Invoice settings", icon: "receipt" },
      { href: "/admin/tax", label: "Tax", icon: "percent" },
      { href: "/admin/payments", label: "Payments", icon: "coins" },
    ],
  },
];

export const adminNav: NavItem[] = adminNavGroups.flatMap((g) => g.items);

import { STORE_CURRENCY } from "@/config/currency";
import { siteConfig } from "@/config/site";
import type { Address, Money, StockStatus, Weight } from "@/lib/types";

const { currencySymbol, numberLocale, dateLocale, timeZone } = siteConfig;
const { minorDigits } = STORE_CURRENCY;

const amountFmt = new Intl.NumberFormat(numberLocale, { maximumFractionDigits: 0 });
const minorFmt = new Intl.NumberFormat(numberLocale, { minimumFractionDigits: minorDigits, maximumFractionDigits: minorDigits });
const factor = 10 ** minorDigits;
const compactFmt = new Intl.NumberFormat(numberLocale, { notation: "compact", maximumFractionDigits: 1 });
const numberFmt = new Intl.NumberFormat(numberLocale);
const dateFmt = new Intl.DateTimeFormat(dateLocale, { day: "numeric", month: "short", year: "numeric", timeZone });
const dateTimeFmt = new Intl.DateTimeFormat(dateLocale, {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone,
});
/** For calendar dates ("YYYY-MM-DD") that carry no time zone. */
const calendarFmt = new Intl.DateTimeFormat(dateLocale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const calendarShortFmt = new Intl.DateTimeFormat(dateLocale, { day: "numeric", month: "short", timeZone: "UTC" });

const signed = (amount: number, text: string) => (amount < 0 ? `-${text}` : text);

/** ¥1,248,000. For currencies with decimals, decimals show only when the amount has them, so displayed lines add up. */
export const formatMoney = (amount: Money) => {
  const abs = Math.abs(amount);
  const fmt = minorDigits === 0 || Math.abs(abs * factor - Math.round(abs) * factor) < 0.5 ? amountFmt : minorFmt;
  return signed(amount, `${currencySymbol}${fmt.format(abs)}`);
};
/** ¥1.2M — for chart axes and tight spaces. */
export const formatMoneyCompact = (amount: Money) =>
  signed(amount, `${currencySymbol}${compactFmt.format(Math.abs(amount))}`);
export const formatNumber = (value: number) => numberFmt.format(value);
export const formatDate = (iso: string) => dateFmt.format(new Date(iso));
export const formatDateTime = (iso: string) => dateTimeFmt.format(new Date(iso));
/** "2026-09-01" → "1 Sept 2026" */
export const formatCalendarDate = (date: string) => calendarFmt.format(new Date(`${date}T00:00:00Z`));
/** "2026-09-01" → "1 Sept" */
export const formatCalendarDateShort = (date: string) => calendarShortFmt.format(new Date(`${date}T00:00:00Z`));
export const formatWeight = (w: Weight) => `${w.value} ${w.unit}`;
/** File size, e.g. "820 KB", "2.4 MB". */
export const formatFileSize = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

/** Percentage change, or undefined when there is no meaningful baseline. */
export function percentChange(current: number, previous: number | undefined) {
  if (previous === undefined || previous === 0) return undefined;
  return ((current - previous) / previous) * 100;
}

/** Address as display lines: street, area/city, prefecture + postcode. */
export function formatAddressLines(a: Pick<Address, "addressLine1" | "addressLine2" | "area" | "city" | "prefecture" | "postalCode">) {
  return [
    [a.addressLine1, a.addressLine2].filter(Boolean).join(", "),
    [a.area, a.city].filter(Boolean).join(", "),
    `${a.prefecture} ${a.postalCode}`,
  ];
}

const countryNames = new Intl.DisplayNames(["en"], { type: "region" });
export const countryName = (code: string) => countryNames.of(code) ?? code;

export const stockLabels: Record<StockStatus, string> = {
  in_stock: "In stock",
  low_stock: "Low stock",
  out_of_stock: "Out of stock",
  backorder: "On backorder",
};

/** "in_stock" → "In stock" for enum-like values without a dedicated label map. */
export const humanize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1).replaceAll("_", " ");

/** "1 Sept 2026 – 30 Sept 2026", or "No comparison" when absent. */
export const formatDateRange = (r?: { from: string; to: string }) =>
  r ? `${formatCalendarDate(r.from)} – ${formatCalendarDate(r.to)}` : "No comparison";

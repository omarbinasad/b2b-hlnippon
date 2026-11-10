import type { CompanyLocale } from "./types/company.ts";

export const CURRENCIES = [
  { code: "JPY", symbol: "¥", digits: 0, name: "Japanese yen" },
  { code: "BDT", symbol: "৳", digits: 2, name: "Bangladeshi taka" },
  { code: "USD", symbol: "$", digits: 2, name: "US dollar" },
  { code: "EUR", symbol: "€", digits: 2, name: "Euro" },
  { code: "GBP", symbol: "£", digits: 2, name: "Pound sterling" },
  { code: "AED", symbol: "AED", digits: 2, name: "UAE dirham" },
  { code: "SAR", symbol: "SAR", digits: 2, name: "Saudi riyal" },
  { code: "KWD", symbol: "KD", digits: 3, name: "Kuwaiti dinar" },
  { code: "INR", symbol: "₹", digits: 2, name: "Indian rupee" },
  { code: "SGD", symbol: "S$", digits: 2, name: "Singapore dollar" },
  { code: "MYR", symbol: "RM", digits: 2, name: "Malaysian ringgit" },
  { code: "AUD", symbol: "A$", digits: 2, name: "Australian dollar" },
  { code: "CAD", symbol: "C$", digits: 2, name: "Canadian dollar" },
] as const;

/** Suggested settings when a country is chosen. Every value stays editable. */
export const COUNTRY_PRESETS: Record<string, Pick<CompanyLocale, "currencyCode" | "numberLocale" | "dateLocale" | "timeZone" | "weekStartsOn">> = {
  JP: { currencyCode: "JPY", numberLocale: "ja-JP", dateLocale: "en-GB", timeZone: "Asia/Tokyo", weekStartsOn: 0 },
  BD: { currencyCode: "BDT", numberLocale: "en-IN", dateLocale: "en-GB", timeZone: "Asia/Dhaka", weekStartsOn: 6 },
  US: { currencyCode: "USD", numberLocale: "en-US", dateLocale: "en-US", timeZone: "America/New_York", weekStartsOn: 0 },
  GB: { currencyCode: "GBP", numberLocale: "en-GB", dateLocale: "en-GB", timeZone: "Europe/London", weekStartsOn: 1 },
  AE: { currencyCode: "AED", numberLocale: "en-AE", dateLocale: "en-GB", timeZone: "Asia/Dubai", weekStartsOn: 1 },
  SA: { currencyCode: "SAR", numberLocale: "en-SA", dateLocale: "en-GB", timeZone: "Asia/Riyadh", weekStartsOn: 0 },
  SG: { currencyCode: "SGD", numberLocale: "en-SG", dateLocale: "en-GB", timeZone: "Asia/Singapore", weekStartsOn: 1 },
  AU: { currencyCode: "AUD", numberLocale: "en-AU", dateLocale: "en-AU", timeZone: "Australia/Sydney", weekStartsOn: 1 },
  CA: { currencyCode: "CAD", numberLocale: "en-CA", dateLocale: "en-CA", timeZone: "America/Toronto", weekStartsOn: 0 },
};

/** Applies a country's suggestions; a country without any keeps the current values. */
export function applyCountry(locale: CompanyLocale, country: string): CompanyLocale {
  const preset = COUNTRY_PRESETS[country];
  if (!preset) return { ...locale, country };
  const currency = CURRENCIES.find((c) => c.code === preset.currencyCode);
  return { ...locale, ...preset, country, currencySymbol: currency?.symbol ?? locale.currencySymbol, currencyDigits: currency?.digits ?? locale.currencyDigits };
}

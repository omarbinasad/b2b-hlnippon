import type { TaxRate, TaxSettings } from "@/lib/types";

/*
 * DEMO tax settings and FICTIONAL rates. None of these percentages is the current
 * Japanese legal consumption tax rate — every rate name says so, and the percentages deliberately
 * differ from the real ones. Stored on globalThis like the other
 * demo stores: edits survive page refreshes but are lost when the server restarts.
 */
const at = "2026-01-05T09:00:00+09:00";

const seedSettings: TaxSettings = {
  // OFF until an admin deliberately enables it (Admin → Tax). The rates below are fictional examples.
  enabled: false,
  pricesIncludeTax: false,
  // Not assumed: shipping is untaxed until an admin turns it on.
  shippingTaxable: false,
  shippingTaxClass: "standard",
  updatedAt: at,
};

const rate = (id: string, r: Omit<TaxRate, "id" | "createdAt" | "updatedAt">): TaxRate => ({ id, ...r, createdAt: at, updatedAt: at });

const seedRates: TaxRate[] = [
  rate("tax-jp-standard", { name: "Demo standard rate (fictional)", percent: 9, taxClass: "standard", location: { type: "country", country: "JP" }, enabled: true, legacyWooId: 1 }),
  rate("tax-jp-reduced", { name: "Demo reduced rate (fictional)", percent: 6, taxClass: "reduced", location: { type: "country", country: "JP" }, enabled: true, legacyWooId: 2 }),
  rate("tax-osaka-standard", { name: "Demo Osaka standard (fictional)", percent: 8.5, taxClass: "standard", location: { type: "prefecture", prefecture: "Osaka" }, enabled: true }),
  rate("tax-yokohama-standard", { name: "Demo Yokohama standard (fictional)", percent: 7, taxClass: "standard", location: { type: "city", prefecture: "Kanagawa", city: "Yokohama-shi Naka-ku" }, enabled: true }),
  rate("tax-shinjuku-standard", { name: "Demo Shinjuku postcode standard (fictional)", percent: 7.5, taxClass: "standard", location: { type: "postcode", postalCode: "160-0023" }, enabled: true }),
  rate("tax-hokkaido-reduced", { name: "Demo Hokkaido reduced (fictional, disabled)", percent: 3, taxClass: "reduced", location: { type: "prefecture", prefecture: "Hokkaido" }, enabled: false }),
];

const store = globalThis as typeof globalThis & { __mockTaxV2?: { settings: TaxSettings; rates: TaxRate[] } };
store.__mockTaxV2 ??= { settings: seedSettings, rates: seedRates };

export const mockTax = store.__mockTaxV2;

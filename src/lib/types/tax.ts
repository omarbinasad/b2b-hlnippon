import type { LegacyRef, TaxClass } from "./catalog";
import type { ID, ISODateString, Money } from "./common";

/*
 * Tax settings and rates. Matching and calculation live in the pure engine
 * (src/lib/tax/engine.ts); the backend performs the authoritative calculation.
 * Demo rates are FICTIONAL — never the current legal rate.
 */

export interface TaxSettings {
  /** Off = no tax is calculated anywhere. */
  enabled: boolean;
  /** true = entered catalog/agreed prices already include tax (tax is extracted); false = tax is added on top. */
  pricesIncludeTax: boolean;
  /** Whether shipping charges are taxed. Not assumed. */
  shippingTaxable: boolean;
  /** Class whose matching rate applies to taxable shipping. */
  shippingTaxClass: TaxClass;
  updatedAt: ISODateString;
}

export type TaxSettingsInput = Pick<TaxSettings, "enabled" | "pricesIncludeTax" | "shippingTaxable" | "shippingTaxClass">;

/** Where a rate applies. Matching priority: postcode > city > prefecture > country (fallback). */
export type TaxLocation =
  | { type: "country"; country: string }
  | { type: "prefecture"; prefecture: string }
  | { type: "city"; prefecture: string; city: string }
  | { type: "postcode"; postalCode: string };

export interface TaxRate extends LegacyRef {
  id: ID;
  name: string;
  /** Percentage, 0–100 with up to 2 decimals. */
  percent: number;
  taxClass: TaxClass;
  location: TaxLocation;
  enabled: boolean;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export type TaxRateInput = Pick<TaxRate, "name" | "percent" | "taxClass" | "location" | "enabled">;

/** The rate that applied to a class at an address (copied into orders). */
export interface AppliedTaxRate {
  rateId: ID;
  name: string;
  percent: number;
  taxClass: TaxClass;
  matchedBy: TaxLocation["type"];
}

/**
 * Everything needed to recalculate an order's tax later without reading current
 * settings or rates: editing a rate never changes an existing order.
 */
export interface OrderTaxSnapshot {
  enabled: boolean;
  pricesIncludeTax: boolean;
  shippingTaxable: boolean;
  /** Rate per class matched for the delivery address; missing = no rate (untaxed). */
  ratesByClass: Partial<Record<TaxClass, AppliedTaxRate>>;
  shippingRate?: AppliedTaxRate;
  capturedAt: ISODateString;
}

/** One line in a tax preview or order (amount after discount, as entered). */
export interface TaxPreviewLineInput {
  productId: ID;
  variationId?: ID;
  quantity: number;
  /** Agreed unit price; omitted → the customer/catalog price. */
  unitPrice?: Money;
  discount?: Money;
}

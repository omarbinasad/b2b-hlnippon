/**
 * Tax rate matching and calculation — pure functions with only type imports (plus the
 * shared money helpers), so they run in the browser, the mock repository and `npm test`.
 * The backend performs the authoritative calculation and must follow the same rules.
 * Demo rates are FICTIONAL.
 *
 * MATCHING (per tax class, one rate per line — rates never stack):
 *   enabled rates of the line's class, by the most specific location that matches the address:
 *     1. exact postcode   2. city (within its prefecture)   3. prefecture   4. country (fallback)
 *   A class + location pair may have only one enabled rate (validated), so each step finds at
 *   most one. No match → the line is untaxed (shown as "no rate"). The "exempt" class is never taxed.
 *
 * CALCULATION (integer minor units):
 *   - Line amount = unit price × quantity − line discount (discounts always come BEFORE tax),
 *     rounded half-up to the minor unit per line (weight-priced lines are scaled by the caller).
 *   - Lines (and shipping, when taxable) are grouped by the rate that applied. Per rate, tax is
 *     calculated once on the items and once on the shipping, each rounded half-up to the minor unit:
 *        prices exclude tax:  tax = amount × p / 100;           total = amounts + tax
 *        prices include tax:  tax = amount × p / (100 + p);     total = amounts (tax already inside)
 *   - Order tax = Σ rate taxes. Shipping uses the same inclusive/exclusive setting as prices.
 *   - Each rate's item tax is shared across its lines (largest remainder, exact to the minor unit),
 *     giving every line a net amount; net sales = items after discounts excluding tax.
 */
import type { AppliedTaxRate, FieldErrors, ID, OrderTaxSnapshot, TaxClass, TaxLocation, TaxRate, TaxRateInput, TaxSettings } from "@/lib/types";
import { allocateMinor, fromMinor, isValidPercent, toMinor } from "../orders/calc.ts";

import { isPostcode, postcodeKey } from "../customers/contact.ts";
import { JP_PREFECTURES as TAX_PREFECTURES } from "../locations.ts";
export { TAX_PREFECTURES };

const norm = (s?: string) => (s ?? "").trim().replace(/\s+/g, " ").toLowerCase();

export interface TaxAddress {
  prefecture: string;
  city: string;
  postalCode?: string;
  country?: string;
}

export const locationLevelLabel: Record<TaxLocation["type"], string> = {
  postcode: "exact postcode",
  city: "city",
  prefecture: "prefecture",
  country: "country (fallback)",
};

export function taxLocationLabel(l: TaxLocation) {
  if (l.type === "postcode") return `Postcode ${l.postalCode}`;
  if (l.type === "city") return `${l.city}, ${l.prefecture}`;
  if (l.type === "prefecture") return `${l.prefecture} prefecture`;
  return "All of Japan";
}

// --- Matching -------------------------------------------------------------------------------

export interface RateMatch {
  rate?: TaxRate;
  level?: TaxLocation["type"];
  explanation: string;
}

export function matchTaxRate(rates: TaxRate[], taxClass: TaxClass, address: TaxAddress): RateMatch {
  if (taxClass === "exempt") return { explanation: "Exempt class — never taxed." };
  const pool = rates.filter((r) => r.enabled && r.taxClass === taxClass);
  const country = (address.country ?? "JP").toUpperCase();
  const steps: [TaxLocation["type"], (l: TaxLocation) => boolean][] = [
    ["postcode", (l) => !!address.postalCode && l.type === "postcode" && postcodeKey(l.postalCode) === postcodeKey(address.postalCode)],
    ["city", (l) => l.type === "city" && norm(l.city) === norm(address.city) && norm(l.prefecture) === norm(address.prefecture)],
    ["prefecture", (l) => l.type === "prefecture" && norm(l.prefecture) === norm(address.prefecture)],
    ["country", (l) => l.type === "country" && l.country === country],
  ];
  for (const [level, test] of steps) {
    const rate = pool.find((r) => test(r.location));
    if (rate) return { rate, level, explanation: `“${rate.name}” (${rate.percent}%) matched by ${locationLevelLabel[level]}.` };
  }
  return { explanation: `No enabled ${taxClass} rate matches this address (and no country-wide fallback), so it is untaxed.` };
}

const applied = (m: RateMatch): AppliedTaxRate | undefined =>
  m.rate && { rateId: m.rate.id, name: m.rate.name, percent: m.rate.percent, taxClass: m.rate.taxClass, matchedBy: m.level! };

/** Settings + matched rates for one address, frozen for an order. */
export function buildTaxSnapshot(settings: Pick<TaxSettings, "enabled" | "pricesIncludeTax" | "shippingTaxable" | "shippingTaxClass">, rates: TaxRate[], address: TaxAddress, classes: TaxClass[], capturedAt: string): OrderTaxSnapshot {
  const ratesByClass: OrderTaxSnapshot["ratesByClass"] = {};
  for (const c of classes) {
    const a = applied(matchTaxRate(rates, c, address));
    if (a) ratesByClass[c] = a;
  }
  return {
    enabled: settings.enabled,
    pricesIncludeTax: settings.pricesIncludeTax,
    shippingTaxable: settings.shippingTaxable,
    ratesByClass,
    shippingRate: settings.shippingTaxable ? applied(matchTaxRate(rates, settings.shippingTaxClass, address)) : undefined,
    capturedAt,
  };
}

// --- Calculation ------------------------------------------------------------------------------

export interface TaxLineInput {
  key: string;
  label: string;
  taxClass: TaxClass;
  /** false for products whose tax status is "none" or "shipping only". */
  taxable: boolean;
  /** Before discount (as entered). */
  subtotal: number;
  discount: number;
}

export interface TaxLineResult extends TaxLineInput {
  /** subtotal − discount, as entered (includes tax when prices include tax). */
  amount: number;
  /** This line's share of its rate's item tax (largest-remainder allocation; shares add up exactly). */
  tax: number;
  /** Line amount excluding tax — the line's net sales. */
  net: number;
  rate?: AppliedTaxRate;
  note: string;
}

export interface TaxGroup {
  rate: AppliedTaxRate;
  /** Amount the tax is calculated on, excluding tax (items + shipping at this rate). */
  taxableAmount: number;
  taxAmount: number;
  /** Tax on the items at this rate (rounded once). */
  itemsTax: number;
  /** Tax on shipping at this rate (rounded once). */
  shippingTax: number;
  /** Lines (keys) and/or "shipping" in this group. */
  members: string[];
}

export interface TaxCalculation {
  enabled: boolean;
  pricesIncludeTax: boolean;
  lines: TaxLineResult[];
  shipping: { amount: number; taxable: boolean; rate?: AppliedTaxRate; tax: number; note: string };
  groups: TaxGroup[];
  itemsSubtotal: number;
  discountTotal: number;
  /** Items after discounts, as entered. */
  itemsTotal: number;
  /** Items after discounts, excluding tax — net sales. */
  itemsNet: number;
  itemsTax: number;
  shippingTotal: number;
  shippingTax: number;
  taxTotal: number;
  /** Payable total. */
  total: number;
  /** Total excluding tax. */
  netTotal: number;
}

function divRoundHalfUp(numerator: bigint, denominator: bigint) {
  const two = BigInt(2);
  return (numerator * two + denominator) / (denominator * two);
}

/** Tax in minor units on an amount in minor units for a percentage (basis points keep 7.5 % exact). */
export function taxOn(amountMinor: number, percent: number, inclusive: boolean) {
  if (amountMinor <= 0 || percent <= 0) return 0;
  const bp = BigInt(Math.round(percent * 100));
  const amount = BigInt(amountMinor);
  return Number(inclusive ? divRoundHalfUp(amount * bp, BigInt(10000) + bp) : divRoundHalfUp(amount * bp, BigInt(10000)));
}

/** Largest-remainder split of whole minor unit (shared with order discounts; see src/lib/orders/calc.ts). */
export const allocate = allocateMinor;

export function calculateTax(snapshot: Pick<OrderTaxSnapshot, "enabled" | "pricesIncludeTax" | "shippingTaxable" | "ratesByClass" | "shippingRate">, lines: TaxLineInput[], shippingAmount: number): TaxCalculation {
  const inclusive = snapshot.pricesIncludeTax;
  // Per rate: item lines and shipping are kept apart so item tax (net sales) is exact.
  const groups = new Map<ID, { rate: AppliedTaxRate; lineIdx: number[]; itemsMinor: number; shippingMinor: number; members: string[] }>();
  const groupFor = (rate: AppliedTaxRate) => {
    const g = groups.get(rate.rateId) ?? { rate, lineIdx: [], itemsMinor: 0, shippingMinor: 0, members: [] };
    groups.set(rate.rateId, g);
    return g;
  };

  let subtotal = 0;
  let discount = 0;
  const amounts: number[] = [];
  const lineResults: TaxLineResult[] = lines.map((l, i) => {
    const s = toMinor(l.subtotal);
    const d = Math.min(Math.max(0, toMinor(l.discount)), s);
    subtotal += s;
    discount += d;
    const amount = s - d;
    amounts.push(amount);
    const base = { ...l, amount: fromMinor(amount), tax: 0, net: fromMinor(amount) };
    if (!snapshot.enabled) return { ...base, note: "Tax is turned off." };
    if (!l.taxable) return { ...base, note: "Product is not taxable (tax status)." };
    if (l.taxClass === "exempt") return { ...base, note: "Exempt class." };
    const rate = snapshot.ratesByClass[l.taxClass];
    if (!rate) return { ...base, note: `No ${l.taxClass} rate for this address.` };
    const g = groupFor(rate);
    g.lineIdx.push(i);
    g.itemsMinor += amount;
    g.members.push(l.key);
    return { ...base, rate, note: `${rate.name} · ${rate.percent}%` };
  });

  const shipMinor = Math.max(0, toMinor(shippingAmount));
  let shippingRate: AppliedTaxRate | undefined;
  let shippingNote: string;
  if (!snapshot.enabled) shippingNote = "Tax is turned off.";
  else if (!snapshot.shippingTaxable) shippingNote = "Shipping is not taxable (tax settings).";
  else if (!snapshot.shippingRate) shippingNote = "Shipping is taxable but no rate matches this address.";
  else {
    shippingRate = snapshot.shippingRate;
    shippingNote = `${shippingRate.name} · ${shippingRate.percent}%`;
    if (shipMinor > 0) {
      const g = groupFor(shippingRate);
      g.shippingMinor += shipMinor;
      g.members.push("shipping");
    }
  }

  let itemsTaxMinor = 0;
  let shippingTaxMinor = 0;
  const groupResults: TaxGroup[] = [...groups.values()].map((g) => {
    const itemsTax = taxOn(g.itemsMinor, g.rate.percent, inclusive);
    const shippingTax = taxOn(g.shippingMinor, g.rate.percent, inclusive);
    itemsTaxMinor += itemsTax;
    shippingTaxMinor += shippingTax;
    // Share the rate's item tax across its lines so per-line net sales add up exactly.
    const shares = allocate(itemsTax, g.lineIdx.map((i) => amounts[i]));
    g.lineIdx.forEach((li, k) => {
      const r = lineResults[li];
      r.tax = fromMinor(shares[k]);
      r.net = fromMinor(inclusive ? amounts[li] - shares[k] : amounts[li]);
    });
    const tax = itemsTax + shippingTax;
    const gross = g.itemsMinor + g.shippingMinor;
    return {
      rate: g.rate,
      taxableAmount: fromMinor(inclusive ? gross - tax : gross),
      taxAmount: fromMinor(tax),
      itemsTax: fromMinor(itemsTax),
      shippingTax: fromMinor(shippingTax),
      members: g.members,
    };
  });

  const taxMinor = itemsTaxMinor + shippingTaxMinor;
  const itemsTotal = subtotal - discount;
  const enteredTotal = itemsTotal + shipMinor;
  const total = inclusive ? enteredTotal : enteredTotal + taxMinor;
  return {
    enabled: snapshot.enabled,
    pricesIncludeTax: inclusive,
    lines: lineResults,
    shipping: { amount: fromMinor(shipMinor), taxable: Boolean(snapshot.enabled && snapshot.shippingTaxable), rate: shippingRate, tax: fromMinor(shippingTaxMinor), note: shippingNote },
    groups: groupResults,
    itemsSubtotal: fromMinor(subtotal),
    discountTotal: fromMinor(discount),
    itemsTotal: fromMinor(itemsTotal),
    itemsNet: fromMinor(inclusive ? itemsTotal - itemsTaxMinor : itemsTotal),
    itemsTax: fromMinor(itemsTaxMinor),
    shippingTotal: fromMinor(shipMinor),
    shippingTax: fromMinor(shippingTaxMinor),
    taxTotal: fromMinor(taxMinor),
    total: fromMinor(total),
    netTotal: fromMinor(total - taxMinor),
  };
}

// --- Validation -------------------------------------------------------------------------------

const locationKey = (l: TaxLocation) =>
  l.type === "postcode" ? `postcode:${postcodeKey(l.postalCode)}` : l.type === "city" ? `city:${norm(l.prefecture)}|${norm(l.city)}` : l.type === "prefecture" ? `prefecture:${norm(l.prefecture)}` : `country:${l.country}`;

/** Validates a rate against the other rates and the known classes. */
export function validateTaxRate(input: TaxRateInput, others: TaxRate[], classes: TaxClass[]): FieldErrors {
  const errors: FieldErrors = {};
  const name = input.name.trim();
  if (name.length < 2) errors.name = "Name the rate (at least 2 characters).";
  else if (name.length > 80) errors.name = "Keep it under 80 characters.";
  if (!isValidPercent(input.percent))
    errors.percent = "Enter a percentage from 0 to 100 (up to 2 decimals).";
  if (!classes.includes(input.taxClass)) errors.taxClass = "Choose an existing tax class.";
  else if (input.taxClass === "exempt") errors.taxClass = "The exempt class is never taxed — choose another class.";
  const l = input.location;
  if (l.type === "postcode" && !isPostcode(l.postalCode)) errors.location = "Use a 7-digit postcode, e.g. 160-0023.";
  if ((l.type === "prefecture" || l.type === "city") && !TAX_PREFECTURES.some((d) => norm(d) === norm(l.prefecture))) errors.location = "Choose a prefecture.";
  if (l.type === "city" && !l.city.trim()) errors.location = "Enter the city.";
  if (l.type === "country" && l.country !== "JP") errors.location = "Only Japan is supported.";
  if (!errors.location && !errors.taxClass && input.enabled) {
    const clash = others.find((r) => r.enabled && r.taxClass === input.taxClass && locationKey(r.location) === locationKey(l));
    if (clash) errors.location = `“${clash.name}” already covers ${taxLocationLabel(l)} for this class. Only one enabled rate per class and location.`;
  }
  return errors;
}

export function validateTaxSettings(input: Pick<TaxSettings, "enabled" | "pricesIncludeTax" | "shippingTaxable" | "shippingTaxClass">, classes: TaxClass[]): FieldErrors {
  const errors: FieldErrors = {};
  if (!classes.includes(input.shippingTaxClass)) errors.shippingTaxClass = "Choose an existing tax class.";
  else if (input.shippingTaxable && input.shippingTaxClass === "exempt") errors.shippingTaxClass = "Taxable shipping needs a class with rates (not exempt).";
  return errors;
}

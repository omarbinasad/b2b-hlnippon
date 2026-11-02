/**
 * Pure order calculations (no I/O; the only runtime import is the pure currency constant), shared by the admin UI
 * previews, the mock repository and the unit tests in `tests/order-calc.test.ts`.
 *
 * Money representation: `Money` values are amounts in the store currency (`STORE_CURRENCY`,
 * JPY by default) with at most `minorDigits` decimals — whole yen for JPY. All arithmetic here
 * happens in exact integer minor units (BigInt), and results are rounded once, half-up, to the
 * minor unit (1 yen). Never add/multiply `Money` floats directly.
 *
 * The backend owns the real rules (tax rates, rounding policy, discounts); this
 * module mirrors the agreed behaviour so previews match what will be saved.
 */
import { STORE_CURRENCY } from "../../config/currency.ts";
import type { TaxClass, TaxLine, Weight } from "@/lib/types";

// --- Money ------------------------------------------------------------------------

const DIGITS = STORE_CURRENCY.minorDigits;
const FACTOR = 10 ** DIGITS;

/**
 * Amount → integer minor units (1 per yen for JPY, 100 per unit for 2-decimal currencies). Uses the
 * fixed-decimal string form, so 0.1 + 0.2 style float noise is removed; extra decimals are rounded.
 */
export function toMinor(amount: number): number {
  if (!Number.isFinite(amount)) throw new Error(`Invalid amount: ${amount}`);
  const [whole, fraction = "0"] = Math.abs(amount).toFixed(DIGITS).split(".");
  const minor = Number(whole) * FACTOR + Number(fraction);
  return amount < 0 ? -minor : minor;
}

/** integer minor units → amount. */
export const fromMinor = (minor: number): number => minor / FACTOR;

/** Exact half-up rounding of numerator/denominator (both non-negative BigInts) to an integer. */
function divRoundHalfUp(numerator: bigint, denominator: bigint): bigint {
  const two = BigInt(2);
  return (numerator * two + denominator) / (denominator * two);
}

/** Sum of Money values without float drift. */
export const sumMoney = (amounts: number[]): number => fromMinor(amounts.reduce((s, a) => s + toMinor(a), 0));

// --- Weight -----------------------------------------------------------------------

export const toGrams = (w: Weight): number => Math.round(w.value * (w.unit === "kg" ? 1000 : 1));

// --- Lines --------------------------------------------------------------------------

export interface LineInput {
  quantity: number;
  /** Agreed price per selling unit (store currency). */
  unitPrice: number;
  /** Line discount (store currency); 0 when none. */
  discount: number;
  /** Price follows the packed weight (e.g. fresh meat). */
  pricedByWeight: boolean;
  orderedWeight: Weight;
  /** Actual packed weight; undefined = not weighed yet (ordered weight applies). */
  fulfilledWeight?: Weight;
}

export interface LineAmounts {
  /** unitPrice × quantity (× fulfilled/ordered weight for weight-priced lines). */
  subtotal: number;
  discount: number;
  /** subtotal − discount, never below 0. */
  total: number;
}

/**
 * Line amounts. For weight-priced lines the price scales with the fulfilled
 * weight: unitPrice × qty × fulfilledGrams / orderedGrams, rounded half-up once.
 * For other lines a different fulfilled weight changes shipping data only.
 */
export function lineAmounts(line: LineInput): LineAmounts {
  if (!Number.isInteger(line.quantity) || line.quantity < 0) throw new Error(`Invalid quantity: ${line.quantity}`);
  const unit = BigInt(toMinor(line.unitPrice));
  const qty = BigInt(line.quantity);
  let subtotal = unit * qty;
  if (line.pricedByWeight && line.fulfilledWeight) {
    const ordered = toGrams(line.orderedWeight);
    const fulfilled = toGrams(line.fulfilledWeight);
    if (ordered > 0) subtotal = divRoundHalfUp(subtotal * BigInt(fulfilled), BigInt(ordered));
  }
  const subtotalMinor = Number(subtotal);
  const discountMinor = Math.min(Math.max(0, toMinor(line.discount)), subtotalMinor);
  return {
    subtotal: fromMinor(subtotalMinor),
    discount: fromMinor(discountMinor),
    total: fromMinor(subtotalMinor - discountMinor),
  };
}

// --- Order discount -----------------------------------------------------------------

/** Order-level discount: a fixed amount or a percentage of the items after line discounts. */
export interface OrderDiscountRule {
  type: "fixed" | "percent";
  value: number;
}

/**
 * Order discount amount for an items total (after line discounts). Fixed amounts are capped at the
 * items total; percentages are rounded half-up to the minor unit. Never negative.
 */
export function orderDiscountAmount(itemsTotal: number, rule?: OrderDiscountRule | null): number {
  const base = Math.max(0, toMinor(itemsTotal));
  if (!rule || !(rule.value > 0) || base === 0) return 0;
  if (rule.type === "fixed") return fromMinor(Math.min(toMinor(rule.value), base));
  const bp = BigInt(Math.round(Math.min(rule.value, 100) * 100));
  return fromMinor(Number(divRoundHalfUp(BigInt(base) * bp, BigInt(10000))));
}

/**
 * Splits `total` minor across `weights` in proportion, using the largest-remainder method:
 * every share is a whole minor unit and the shares add up to exactly `total` (ties → earlier index).
 */
export function allocateMinor(total: number, weights: number[]): number[] {
  const sum = weights.reduce((s, w) => s + w, 0);
  if (total === 0 || sum <= 0) return weights.map(() => 0);
  const exact = weights.map((w) => (BigInt(total) * BigInt(w)));
  const base = exact.map((e) => Number(e / BigInt(sum)));
  let left = total - base.reduce((s, b) => s + b, 0);
  const order = exact.map((e, i) => ({ i, r: e % BigInt(sum) })).sort((a, b) => (a.r === b.r ? a.i - b.i : a.r > b.r ? -1 : 1));
  for (const { i } of order) {
    if (left <= 0) break;
    base[i] += 1;
    left -= 1;
  }
  return base;
}

/** Splits an `amount` over line totals in proportion (see `allocateMinor`); capped at their sum, so no share exceeds its line. */
export function allocateMoney(amount: number, lineTotals: number[]): number[] {
  const weights = lineTotals.map((w) => Math.max(0, toMinor(w)));
  const target = Math.min(Math.max(0, toMinor(amount)), weights.reduce((s, w) => s + w, 0));
  return allocateMinor(target, weights).map(fromMinor);
}

// --- Orders -------------------------------------------------------------------------

/** VAT rate per class as a percentage (may have decimals, e.g. 7.5). Placeholder until the tax module exists. */
export type TaxRates = Record<TaxClass, number>;

export interface TotalsInput {
  lines: (LineInput & { taxClass: TaxClass })[];
  shipping: { amount: number; taxClass: TaxClass };
  /** Order-level discount, applied after line discounts and before tax. */
  orderDiscount?: OrderDiscountRule | null;
  /** Recorded refund amounts (store currency). */
  refunds?: number[];
}

export interface OrderTotals {
  itemsSubtotal: number;
  /** Line discounts + order discount. */
  discountTotal: number;
  /** Items after all discounts (net sales, excl. VAT and shipping). */
  itemsTotal: number;
  /** Order-level discount amount (included in discountTotal). */
  orderDiscount: number;
  shippingTotal: number;
  taxes: TaxLine[];
  taxTotal: number;
  /** itemsTotal + shipping + VAT. */
  total: number;
  refundedTotal: number;
  /** total − refunds. */
  netTotal: number;
}

/**
 * Order discount share per line (see `allocateMoney`), so tax is charged on what the customer actually pays.
 * Returns zeros when there is no order discount.
 */
export function orderDiscountShares(lines: LineInput[], rule?: OrderDiscountRule | null): number[] {
  const totals = lines.map((l) => lineAmounts(l).total);
  return allocateMoney(orderDiscountAmount(sumMoney(totals), rule), totals);
}

/** Tax per class on (line totals after the order discount share + shipping in its class), rounded half-up per class. */
export function orderTotals(input: TotalsInput, rates: TaxRates): OrderTotals {
  const shares = orderDiscountShares(input.lines, input.orderDiscount);
  const lines = input.lines.map((l, i) => {
    const a = lineAmounts(l);
    return { taxClass: l.taxClass, subtotal: a.subtotal, discount: fromMinor(toMinor(a.discount) + toMinor(shares[i])), total: fromMinor(toMinor(a.total) - toMinor(shares[i])) };
  });
  const taxable = new Map<TaxClass, number>();
  const add = (cls: TaxClass, minor: number) => taxable.set(cls, (taxable.get(cls) ?? 0) + minor);
  for (const l of lines) add(l.taxClass, toMinor(l.total));
  const shippingMinor = Math.max(0, toMinor(input.shipping.amount));
  if (shippingMinor > 0) add(input.shipping.taxClass, shippingMinor);

  const taxes: TaxLine[] = [];
  for (const [taxClass, base] of taxable) {
    const rate = rates[taxClass] ?? 0;
    if (base <= 0 || rate <= 0) continue;
    // Rate in basis points keeps decimal rates (7.5 %) exact.
    const bp = BigInt(Math.round(rate * 100));
    const tax = Number(divRoundHalfUp(BigInt(base) * bp, BigInt(10000)));
    taxes.push({ taxClass, rate, taxableAmount: fromMinor(base), taxAmount: fromMinor(tax) });
  }

  const itemsSubtotal = lines.reduce((s, l) => s + toMinor(l.subtotal), 0);
  const discountTotal = lines.reduce((s, l) => s + toMinor(l.discount), 0);
  const itemsTotal = itemsSubtotal - discountTotal;
  const taxTotal = taxes.reduce((s, t) => s + toMinor(t.taxAmount), 0);
  const total = itemsTotal + shippingMinor + taxTotal;
  const refunded = (input.refunds ?? []).reduce((s, r) => s + toMinor(r), 0);
  return {
    itemsSubtotal: fromMinor(itemsSubtotal),
    discountTotal: fromMinor(discountTotal),
    itemsTotal: fromMinor(itemsTotal),
    orderDiscount: fromMinor(shares.reduce((s, x) => s + toMinor(x), 0)),
    shippingTotal: fromMinor(shippingMinor),
    taxes,
    taxTotal: fromMinor(taxTotal),
    total: fromMinor(total),
    refundedTotal: fromMinor(refunded),
    netTotal: fromMinor(total - refunded),
  };
}

// --- Adjustments --------------------------------------------------------------------

export interface AdjustmentChange {
  /** New quantity; undefined = unchanged. The ordered weight scales with it. */
  quantity?: number;
  /** New agreed unit price; undefined = unchanged. */
  unitPrice?: number;
  /** New fulfilled (packed) weight; undefined = unchanged. */
  fulfilledWeight?: Weight;
}

/** Ordered weight for a new quantity (same weight per unit), to the gram, in the original unit. */
export function scaleOrderedWeight(weight: Weight, fromQuantity: number, toQuantity: number): Weight {
  if (fromQuantity <= 0) return weight;
  const grams = Math.round((toGrams(weight) * toQuantity) / fromQuantity);
  return { value: weight.unit === "kg" ? grams / 1000 : grams, unit: weight.unit };
}

/** A line with an adjustment applied (quantity first, so the ordered weight follows it). */
export function applyLineChange<T extends LineInput>(line: T, change: AdjustmentChange): T {
  const quantity = change.quantity ?? line.quantity;
  return {
    ...line,
    quantity,
    orderedWeight: quantity === line.quantity ? line.orderedWeight : scaleOrderedWeight(line.orderedWeight, line.quantity, quantity),
    unitPrice: change.unitPrice ?? line.unitPrice,
    fulfilledWeight: change.fulfilledWeight ?? line.fulfilledWeight,
  };
}

export interface AdjustmentPreview {
  lineBefore: LineAmounts;
  lineAfter: LineAmounts;
  totalBefore: number;
  totalAfter: number;
  /** totalAfter − totalBefore. */
  difference: number;
}

/**
 * Before/after amounts for adjusting one line. `lines[index]` is the line being
 * changed; everything else (other lines, shipping, refunds) stays the same.
 */
export function previewAdjustment(input: TotalsInput, index: number, change: AdjustmentChange, rates: TaxRates): AdjustmentPreview {
  const line = input.lines[index];
  if (!line) throw new Error(`No line at index ${index}`);
  const changed = applyLineChange(line, change);
  const before = orderTotals(input, rates);
  const after = orderTotals({ ...input, lines: input.lines.map((l, i) => (i === index ? changed : l)) }, rates);
  return {
    lineBefore: lineAmounts(line),
    lineAfter: lineAmounts(changed),
    totalBefore: before.total,
    totalAfter: after.total,
    difference: fromMinor(toMinor(after.total) - toMinor(before.total)),
  };
}

/** True when a Money value has at most `minorDigits` decimals (whole yen for JPY) and is ≥ 0. */
export const isValidAmount = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 && Math.abs(fromMinor(toMinor(v)) - v) < 1e-9;

/** Wording of the amount precision rule for messages: "no decimals" for JPY. */
export const AMOUNT_RULE = DIGITS === 0 ? "no decimals" : `up to ${DIGITS} decimals`;

/** A percentage from 0 to 100 with up to 2 decimals (12.5 % is fine; independent of the currency). */
export const isValidPercent = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 100 && Math.abs(Math.round(v * 100) - v * 100) < 1e-6;

/** `step` for amount inputs: "1" for JPY, "0.01" for 2-decimal currencies. */
export const AMOUNT_STEP = DIGITS === 0 ? "1" : (1 / FACTOR).toFixed(DIGITS);

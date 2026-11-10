/**
 * Pure coupon rules (WooCommerce-like). Tested; the backend must match them and re-check at checkout. Coupon discounts
 * are promotional and customer-entered: they are recorded apart from the order discount staff can add to an order.
 */
import { allocateMoney, amountRule, fromMinor, isValidAmount, toMinor } from "../orders/calc.ts";
import type { Coupon, CouponInput } from "../types/coupon.ts";

export interface CouponCartLine {
  id: string;
  productId: string;
  /** The product's category slugs, including parents. */
  categorySlugs: string[];
  quantity: number;
  lineTotal: number;
}

export interface CouponContext {
  /** YYYY-MM-DD in store time. */
  today: string;
  customerId: string;
  groupId?: string;
  lines: CouponCartLine[];
  /** Earlier uses of this coupon by this customer. */
  usedByCustomer: number;
}

export type CouponResult = { ok: true; discount: number; allocations: Record<string, number> } | { ok: false; error: string };

const no = (error: string): CouponResult => ({ ok: false, error });

function eligibleLines(c: Coupon, lines: CouponCartLine[]) {
  const restricted = c.productIds.length > 0 || c.categorySlugs.length > 0;
  return lines.filter((l) => {
    if (c.excludedProductIds.includes(l.productId)) return false;
    return !restricted || c.productIds.includes(l.productId) || l.categorySlugs.some((s) => c.categorySlugs.includes(s));
  });
}

export function evaluateCoupon(c: Coupon, ctx: CouponContext): CouponResult {
  if (!c.enabled) return no("This coupon isn't active.");
  if (c.startsOn && ctx.today < c.startsOn) return no("This coupon isn't active yet.");
  if (c.expiresOn && ctx.today > c.expiresOn) return no("This coupon has expired.");
  if (c.usageLimit !== undefined && c.usedCount >= c.usageLimit) return no("This coupon has reached its usage limit.");
  if (c.usageLimitPerCustomer !== undefined && ctx.usedByCustomer >= c.usageLimitPerCustomer) return no("You have already used this coupon.");
  const limited = c.customerIds.length > 0 || c.groupIds.length > 0;
  if (limited && !c.customerIds.includes(ctx.customerId) && !(ctx.groupId && c.groupIds.includes(ctx.groupId))) return no("This coupon isn't available for your account.");

  const subtotal = ctx.lines.reduce((sum, l) => sum + toMinor(l.lineTotal), 0);
  if (c.minSpend !== undefined && subtotal < toMinor(c.minSpend)) return no("Your order is below this coupon's minimum spend.");
  if (c.maxSpend !== undefined && subtotal > toMinor(c.maxSpend)) return no("Your order is above this coupon's maximum spend.");

  const lines = eligibleLines(c, ctx.lines);
  if (!lines.length) return no("This coupon doesn't apply to the products in your cart.");

  const totals = lines.map((l) => toMinor(l.lineTotal));
  const eligible = totals.reduce((a, b) => a + b, 0);
  let shares: number[];
  if (c.type === "percent") {
    // Half-up on the eligible total, then shared out so the lines add up exactly.
    const off = Math.floor((eligible * Math.round(c.amount * 100) + 5000) / 10000);
    shares = allocateMoney(fromMinor(Math.min(off, eligible)), totals.map(fromMinor)).map(toMinor);
  } else if (c.type === "fixed_cart") {
    shares = allocateMoney(fromMinor(Math.min(toMinor(c.amount), eligible)), totals.map(fromMinor)).map(toMinor);
  } else {
    shares = lines.map((l, i) => Math.min(toMinor(c.amount) * l.quantity, totals[i]));
  }
  const allocations: Record<string, number> = {};
  lines.forEach((l, i) => {
    if (shares[i] > 0) allocations[l.id] = fromMinor(shares[i]);
  });
  return { ok: true, discount: fromMinor(shares.reduce((a, b) => a + b, 0)), allocations };
}

export const normalizeCode = (code: string) => code.trim().toUpperCase();

export function validateCoupon(input: CouponInput, taken: (code: string) => boolean): Record<string, string> {
  const errors: Record<string, string> = {};
  const code = normalizeCode(input.code);
  if (!/^[A-Z0-9][A-Z0-9_-]{2,29}$/.test(code)) errors.code = "Use 3 to 30 letters, numbers, hyphens or underscores.";
  else if (taken(code)) errors.code = "Another coupon already uses this code.";
  if (!["percent", "fixed_cart", "fixed_product"].includes(input.type)) errors.type = "Choose a discount type.";
  if (!Number.isFinite(input.amount) || input.amount <= 0) errors.amount = "Enter an amount above zero.";
  else if (input.type === "percent" && input.amount > 100) errors.amount = "A percentage can't be above 100.";
  else if (input.type !== "percent" && !isValidAmount(input.amount)) errors.amount = `Enter an amount with ${amountRule()}.`;
  if (input.minSpend !== undefined && (!Number.isFinite(input.minSpend) || input.minSpend < 0)) errors.minSpend = "Enter zero or more.";
  if (input.maxSpend !== undefined && (!Number.isFinite(input.maxSpend) || input.maxSpend <= 0)) errors.maxSpend = "Enter an amount above zero.";
  if (input.minSpend !== undefined && input.maxSpend !== undefined && input.maxSpend < input.minSpend) errors.maxSpend = "Must be at least the minimum spend.";
  if (input.startsOn && input.expiresOn && input.expiresOn < input.startsOn) errors.expiresOn = "Must be on or after the start date.";
  for (const key of ["usageLimit", "usageLimitPerCustomer"] as const) {
    const v = input[key];
    if (v !== undefined && (!Number.isInteger(v) || v < 1)) errors[key] = "Enter a whole number of at least 1.";
  }
  if ((input.description ?? "").length > 300) errors.description = "Keep it under 300 characters.";
  return errors;
}

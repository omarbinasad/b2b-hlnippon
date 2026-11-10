/**
 * Cart and checkout rules shared by the cart, checkout and their tests (pure; tested in tests/cart-checkout.test.ts).
 * The backend must enforce the same rules when it receives an order.
 */
import type { BackorderPolicy, CartLineInput, ID, PaymentMethod, PaymentMethodId, StockInfo } from "../types/index.ts";

export const CART_LIMITS = { lines: 100, quantity: 10_000, note: 500 } as const;

export const cartLineId = (productId: ID, variationId?: ID) => `${productId}:${variationId ?? ""}`;

/** Adds lines to a cart, summing quantities of the same product option (capped at the quantity limit). */
export function mergeCartLines(current: CartLineInput[], added: CartLineInput[]): CartLineInput[] {
  const out = current.map((l) => ({ ...l }));
  for (const line of added) {
    const existing = out.find((l) => cartLineId(l.productId, l.variationId) === cartLineId(line.productId, line.variationId));
    if (existing) existing.quantity = Math.min(CART_LIMITS.quantity, existing.quantity + line.quantity);
    else out.push({ productId: line.productId, variationId: line.variationId || undefined, quantity: Math.min(CART_LIMITS.quantity, line.quantity) });
  }
  return out;
}

export interface CartLineCheck {
  quantity: number;
  min: number;
  max?: number;
  step: number;
  stock: StockInfo;
  /** "quantity" = counted stock, "status" = a status set by hand (see src/lib/orders/stock.ts). */
  stockMode: "quantity" | "status";
  backorders: BackorderPolicy;
  priced: boolean;
  /** Archived product, removed or disabled option. */
  unavailable?: string;
}

/** Why a cart line can't be ordered as it is, or undefined when it can. */
export const NO_PRICE_ERROR = "This product has no price yet and can't be ordered online.";

export function checkCartLine(c: CartLineCheck): string | undefined {
  if (c.unavailable) return c.unavailable;
  if (!c.priced) return NO_PRICE_ERROR;
  if (!Number.isInteger(c.quantity) || c.quantity < 1) return "Enter a whole number of at least 1.";
  if (c.quantity < c.min) return `Minimum ${c.min} per order.`;
  if (c.max !== undefined && c.quantity > c.max) return `Maximum ${c.max} per order.`;
  if (c.step > 1 && c.quantity % c.step !== 0) return `Order in multiples of ${c.step}.`;
  const backorder = c.backorders !== "no";
  if (c.stock.status === "out_of_stock" && !backorder) return "Out of stock.";
  if (c.stockMode === "quantity" && !backorder && c.stock.quantity !== undefined && c.quantity > c.stock.quantity)
    return c.stock.quantity > 0 ? `Only ${c.stock.quantity} in stock.` : "Out of stock.";
  return undefined;
}

/** Store checkout methods → the order's payment method. Online payment has no provider, so it can't be chosen. */
export const orderPaymentMethod: Partial<Record<PaymentMethodId, PaymentMethod>> = {
  pay_on_delivery: "cash_on_delivery",
  bank_transfer: "bank_transfer",
};

/** Delivery date check: YYYY-MM-DD, not before `today` (store calendar date) and within ~3 months. */
export function checkDeliveryDate(date: string | undefined, today: string): string | undefined {
  if (!date) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) return "Choose a valid date.";
  if (date < today) return "Choose today or a later date.";
  const limit = new Date(`${today}T00:00:00Z`);
  limit.setUTCDate(limit.getUTCDate() + 92);
  if (date > limit.toISOString().slice(0, 10)) return "Choose a date within the next three months.";
  return undefined;
}

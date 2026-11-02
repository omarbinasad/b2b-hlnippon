/**
 * Refund rules (pure; tested in tests/refunds.test.ts) — the reference the backend must match.
 *
 * Two kinds of refund:
 * - "order": items (quantity and/or amount), shipping or another amount. Lowers the order value
 *   (`totals.refundedTotal`, `netTotal`) and the amount kept, so the balance due is unchanged.
 * - "overpayment": returns money paid above the current total after the order was edited down. Only lowers
 *   the amount kept; the order value stays as it is.
 *
 * Refunds need payment collected first (status paid / partially refunded). Each line can be refunded up to its
 * share of the order total (after line and order discounts, tax included); shipping up to its taxed amount.
 * DEMO: recording a refund here moves no money — the payment backend processes it.
 */
// Relative imports (not the @/ alias) so the Node test runner can load this module.
import { snapshotTax } from "./assemble.ts";
import { AMOUNT_RULE, allocateMinor, fromMinor, isValidAmount, orderDiscountShares, toMinor } from "./calc.ts";
import { STORE_CURRENCY } from "../../config/currency.ts";
import { checkReason } from "../validation/order.ts";
import type { FieldErrors, ID, Money, Order, PaymentStatus, Refund, RefundInput } from "@/lib/types";

type RefundOrder = Pick<Order, "items" | "shipping" | "refunds" | "totals" | "payment" | "paymentStatus" | "status"> & Partial<Pick<Order, "taxSnapshot" | "discount">>;

export interface RefundableLine {
  itemId: ID;
  name: string;
  sku: string;
  unitLabel: string;
  quantity: number;
  refundedQuantity: number;
  /** Line's share of the order total (tax included). */
  gross: Money;
  refundedAmount: Money;
  /** Still refundable on this line. */
  maxAmount: Money;
}

export interface RefundSummary {
  /** Payment was collected, so refunds can be recorded. */
  collected: boolean;
  lines: RefundableLine[];
  shipping: { gross: Money; refunded: Money; maxAmount: Money };
  /** Most an "order" refund can be now (amount kept, at most the order value). */
  refundable: Money;
  /** Paid above the current total (an "overpayment" refund can return it). */
  overpaid: Money;
  /** Amount received and not yet refunded. */
  kept: Money;
}

const money0 = (v: Money) => `${STORE_CURRENCY.symbol}${v.toLocaleString("en", { minimumFractionDigits: STORE_CURRENCY.minorDigits })}`;

export const isOrderRefund = (r: Pick<Refund, "kind">) => (r.kind ?? "order") === "order";

export const isCollected = (status: PaymentStatus) => status === "paid" || status === "partially_refunded";

/** Line and shipping shares (minor units) of the order total; they add up to the total exactly. */
function grossShares(order: RefundOrder): { lines: number[]; shipping: number } {
  let weights: number[];
  let shippingWeight: number;
  if (order.taxSnapshot) {
    const t = snapshotTax(order);
    const inclusive = t.pricesIncludeTax;
    weights = t.lines.map((l) => toMinor(l.amount) + (inclusive ? 0 : toMinor(l.tax)));
    shippingWeight = toMinor(t.shippingTotal) + (inclusive ? 0 : toMinor(t.shippingTax));
  } else {
    // Older orders (placeholder class rates): shares in proportion to the amounts before tax.
    const shares = orderDiscountShares(order.items, order.discount);
    weights = order.items.map((i, idx) => toMinor(i.lineTotal) - toMinor(shares[idx]));
    shippingWeight = toMinor(order.shipping.amount);
  }
  const all = allocateMinor(toMinor(order.totals.total), [...weights, shippingWeight].map((w) => Math.max(0, w)));
  return { lines: all.slice(0, -1), shipping: all.at(-1)! };
}

export function refundSummary(order: RefundOrder): RefundSummary {
  const collected = isCollected(order.paymentStatus);
  const shares = grossShares(order);
  const orderRefunds = order.refunds.filter(isOrderRefund);
  const lines = order.items.map((item, i) => {
    const refundedQuantity = orderRefunds.reduce((s, r) => s + (r.lines ?? []).filter((l) => l.orderItemId === item.id).reduce((q, l) => q + l.quantity, 0), 0);
    const refundedMinor = orderRefunds.reduce((s, r) => s + (r.lines ?? []).filter((l) => l.orderItemId === item.id).reduce((a, l) => a + toMinor(l.amount), 0), 0);
    return {
      itemId: item.id,
      name: item.name,
      sku: item.sku,
      unitLabel: item.unitLabel,
      quantity: item.quantity,
      refundedQuantity,
      gross: fromMinor(shares.lines[i]),
      refundedAmount: fromMinor(refundedMinor),
      maxAmount: fromMinor(Math.max(0, shares.lines[i] - refundedMinor)),
    };
  });
  const shippingRefunded = orderRefunds.reduce((s, r) => s + toMinor(r.shipping ?? 0), 0);
  const net = toMinor(order.totals.netTotal);
  const kept = collected ? toMinor(order.payment.amountPaid ?? order.totals.netTotal) : 0;
  return {
    collected,
    lines,
    shipping: { gross: fromMinor(shares.shipping), refunded: fromMinor(shippingRefunded), maxAmount: fromMinor(Math.max(0, shares.shipping - shippingRefunded)) },
    refundable: fromMinor(Math.max(0, Math.min(kept, net))),
    overpaid: fromMinor(Math.max(0, kept - net)),
    kept: fromMinor(kept),
  };
}

/** Suggested amount for refunding `quantity` units of a line: its share per unit, capped at what's left. */
export function suggestedLineAmount(line: RefundableLine, quantity: number): Money {
  if (quantity <= 0 || line.quantity <= 0) return 0;
  const left = line.quantity - line.refundedQuantity;
  if (quantity >= left) return line.maxAmount;
  const perUnit = Number((BigInt(toMinor(line.gross)) * BigInt(quantity) * BigInt(2) + BigInt(line.quantity)) / (BigInt(line.quantity) * BigInt(2)));
  return fromMinor(Math.min(perUnit, toMinor(line.maxAmount)));
}

export interface RefundCheck {
  errors: FieldErrors;
  /** Set when the refund can't be recorded at all (not a field problem). */
  message?: string;
  /** Refund total (lines + shipping + other). */
  amount: Money;
}

/** Validates a refund against the order. Field keys: `lines.<i>.quantity|amount`, `shipping`, `other`, `amount`, `reason`. */
export function checkRefund(order: RefundOrder, input: RefundInput): RefundCheck {
  const errors: FieldErrors = {};
  const s = refundSummary(order);
  if (!s.collected) return { errors, amount: 0, message: "Record the payment first — only collected payments can be refunded." };
  checkReason(errors, input.reason);
  const money = (key: string, v: number, max?: number) => {
    if (!isValidAmount(v)) errors[key] = `Enter a valid amount (0 or more, ${AMOUNT_RULE}).`;
    else if (max !== undefined && toMinor(v) > toMinor(max)) errors[key] = `At most ${money0(max)} can be refunded here.`;
  };
  let total = 0;

  if (input.kind === "overpayment") {
    if (input.lines.some((l) => l.quantity || l.amount) || input.shipping) return { errors, amount: 0, message: "An overpayment refund is a single amount — clear the item and shipping amounts." };
    if (input.restock) return { errors, amount: 0, message: "Nothing is restocked for an overpayment refund." };
    if (s.overpaid <= 0) return { errors, amount: 0, message: "This order is not overpaid." };
    money("other", input.other, s.overpaid);
    total = isValidAmount(input.other) ? toMinor(input.other) : 0;
  } else if (input.kind === "order") {
    const seen = new Set<ID>();
    input.lines.forEach((l, i) => {
      const line = s.lines.find((x) => x.itemId === l.orderItemId);
      if (!line || seen.has(l.orderItemId)) {
        errors[`lines.${i}.amount`] = "Unknown order item.";
        return;
      }
      seen.add(l.orderItemId);
      const left = line.quantity - line.refundedQuantity;
      if (!Number.isInteger(l.quantity) || l.quantity < 0 || l.quantity > left) errors[`lines.${i}.quantity`] = `Enter 0 to ${left}.`;
      money(`lines.${i}.amount`, l.amount, line.maxAmount);
      if (isValidAmount(l.amount)) total += toMinor(l.amount);
    });
    money("shipping", input.shipping, s.shipping.maxAmount);
    money("other", input.other);
    if (isValidAmount(input.shipping)) total += toMinor(input.shipping);
    if (isValidAmount(input.other)) total += toMinor(input.other);
    if (!errors.amount && total > toMinor(s.refundable)) errors.amount = `The refund can't exceed ${money0(s.refundable)} (paid and not yet refunded).`;
  } else return { errors, amount: 0, message: "Choose the refund type." };

  if (total <= 0 && !Object.keys(errors).some((k) => k !== "reason")) errors.amount = "Enter an amount to refund.";
  return { errors, amount: fromMinor(total) };
}

/** Payment status after a refund leaves `keptAfter` received (minor units compared exactly). */
export function paymentStatusAfterRefund(keptAfter: Money, hasOrderRefunds: boolean): PaymentStatus {
  if (toMinor(keptAfter) <= 0) return "refunded";
  return hasOrderRefunds ? "partially_refunded" : "paid";
}

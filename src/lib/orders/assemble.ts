/**
 * Keeps an order's derived money fields (line amounts, tax lines, totals) in sync with its
 * items, order discount, shipping and refunds. Orders with a tax snapshot (created with tax
 * settings) are recalculated from that snapshot; older orders keep the placeholder per-class rates.
 */
// Relative imports (not the @/ alias) so the Node test runner can load this module.
import { calculateTax, type TaxCalculation } from "../tax/engine.ts";
import type { Order, OrderItem, TaxLine } from "@/lib/types";
import { applyLineChange, fromMinor, lineAmounts, orderDiscountShares, orderTotals, toMinor, type AdjustmentChange, type AdjustmentPreview, type TaxRates, type TotalsInput } from "./calc.ts";

type Recalculable = Pick<Order, "items" | "shipping" | "refunds"> & Partial<Pick<Order, "taxSnapshot" | "discount">>;

export function totalsInput(order: Recalculable): TotalsInput {
  return {
    lines: order.items.map((i) => ({
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      discount: i.discount,
      pricedByWeight: i.pricedByWeight,
      orderedWeight: i.orderedWeight,
      fulfilledWeight: i.fulfilledWeight,
      taxClass: i.taxClass,
    })),
    shipping: { amount: order.shipping.amount, taxClass: order.shipping.taxClass },
    orderDiscount: order.discount,
    // Overpayment refunds return money paid above the total; they do not lower the order value.
    refunds: order.refunds.filter((r) => (r.kind ?? "order") === "order").map((r) => r.amount),
  };
}

/** Tax calculation for an order with a snapshot (weight-priced lines scaled first; order discount shared over lines). */
export function snapshotTax(order: Recalculable): TaxCalculation {
  const shares = orderDiscountShares(order.items, order.discount);
  return calculateTax(
    order.taxSnapshot!,
    order.items.map((i, idx) => {
      const a = lineAmounts(i);
      return { key: i.id, label: i.name, taxClass: i.taxClass, taxable: i.taxable !== false, subtotal: a.subtotal, discount: fromMinor(toMinor(a.discount) + toMinor(shares[idx])) };
    }),
    order.shipping.amount,
  );
}

/** Returns a copy with line amounts, `taxes` and `totals` recalculated. Line totals exclude the order discount. */
export function recalculate<T extends Recalculable>(order: T, rates: TaxRates): T & Pick<Order, "taxes" | "totals"> {
  const items: OrderItem[] = order.items.map((i) => {
    const a = lineAmounts(i);
    return { ...i, lineSubtotal: a.subtotal, lineTotal: a.total };
  });
  if (order.taxSnapshot) {
    const t = snapshotTax({ ...order, items });
    const shares = orderDiscountShares(items, order.discount);
    const orderDiscount = shares.reduce((s, x) => s + toMinor(x), 0);
    const refunded = order.refunds.filter((r) => (r.kind ?? "order") === "order").reduce((s, r) => s + toMinor(r.amount), 0);
    const netByLine = new Map(t.lines.map((l) => [l.key, l.net]));
    const withNet = items.map((i) => ({ ...i, lineNet: netByLine.get(i.id) ?? i.lineTotal }));
    const taxes: TaxLine[] = t.groups.map((g) => ({ taxClass: g.rate.taxClass, rate: g.rate.percent, taxableAmount: g.taxableAmount, taxAmount: g.taxAmount, rateId: g.rate.rateId, rateName: g.rate.name }));
    return {
      ...order,
      items: withNet,
      taxes,
      totals: {
        itemsSubtotal: t.itemsSubtotal,
        discountTotal: t.discountTotal,
        itemsTotal: t.itemsTotal,
        orderDiscount: orderDiscount ? fromMinor(orderDiscount) : undefined,
        shippingTotal: t.shippingTotal,
        taxTotal: t.taxTotal,
        total: t.total,
        refundedTotal: fromMinor(refunded),
        netTotal: fromMinor(toMinor(t.total) - refunded),
        taxIncluded: t.pricesIncludeTax || undefined,
        itemsNet: t.itemsNet,
        itemsTax: t.itemsTax,
      },
    };
  }
  const { taxes, orderDiscount, ...totals } = orderTotals(totalsInput({ ...order, items }), rates);
  return { ...order, items, taxes, totals: { ...totals, orderDiscount: orderDiscount || undefined } };
}

/** Before/after amounts for adjusting one item (quantity, price, weight), using the order's own tax basis. */
export function previewOrderAdjustment(order: Recalculable, index: number, change: AdjustmentChange, rates: TaxRates): AdjustmentPreview {
  const item = order.items[index];
  if (!item) throw new Error(`No item at index ${index}`);
  const changed = applyLineChange(item, change);
  const before = recalculate(order, rates).totals.total;
  const after = recalculate({ ...order, items: order.items.map((it, i) => (i === index ? changed : it)) }, rates).totals.total;
  return {
    lineBefore: lineAmounts(item),
    lineAfter: lineAmounts(changed),
    totalBefore: before,
    totalAfter: after,
    difference: fromMinor(toMinor(after) - toMinor(before)),
  };
}

/**
 * What is still owed against payment already collected: positive = collect more, negative = overpaid
 * (refund due). Undefined when nothing was collected (`payment.amountPaid` absent) — the total is simply due.
 */
export function paymentBalance(order: Pick<Order, "payment" | "totals">): number | undefined {
  if (order.payment.amountPaid === undefined) return undefined;
  return fromMinor(toMinor(order.totals.netTotal) - toMinor(order.payment.amountPaid));
}

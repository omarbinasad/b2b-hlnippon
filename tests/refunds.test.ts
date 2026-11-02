/** Refund rules: caps per line / shipping / amount kept, overpayment refunds, payment status. Run with `npm test`. */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Order, OrderItem, Refund, RefundInput } from "../src/lib/types/index.ts";
import { paymentBalance, recalculate } from "../src/lib/orders/assemble.ts";
import type { TaxRates } from "../src/lib/orders/calc.ts";
import { checkRefund, paymentStatusAfterRefund, refundSummary, suggestedLineAmount } from "../src/lib/orders/refund.ts";

const rates: TaxRates = { standard: 10, reduced: 8, exempt: 0 };
const kg = (value: number) => ({ value, unit: "kg" as const });
const item = (id: string, unitPrice: number, quantity: number): OrderItem =>
  ({ id, productId: id, name: id, sku: id, unitLabel: "case", taxClass: "standard", pricedByWeight: false, quantity, catalogUnitPrice: unitPrice, unitPrice, discount: 0, orderedWeight: kg(quantity), lineSubtotal: 0, lineTotal: 0 }) as OrderItem;

// 3 × ¥1,000 + 1 × ¥500 + ¥500 delivery, tax 10 % added → ¥4,400.
const order = (over: Partial<Order> = {}) =>
  recalculate(
    {
      items: [item("a", 1000, 3), item("b", 500, 1)],
      shipping: { label: "Route", amount: 500, taxClass: "standard" },
      refunds: [],
      payment: { method: "bank_transfer" },
      paymentStatus: "paid",
      status: "delivered",
      ...over,
    } as Order,
    rates,
  );
const input = (over: Partial<RefundInput> = {}): RefundInput => ({ kind: "order", lines: [], shipping: 0, other: 0, reason: "Damaged on delivery", restock: false, ...over });
const refund = (over: Partial<Refund>): Refund => ({ id: "r", amount: 0, reason: "x", at: "2026-10-29T00:00:00Z", by: { id: "a", name: "A", role: "admin" }, status: "recorded", ...over });

describe("refund summary", () => {
  it("splits the paid total over lines and shipping, tax included", () => {
    const o = order();
    assert.equal(o.totals.total, 4400);
    const s = refundSummary(o);
    assert.deepEqual(s.lines.map((l) => l.gross), [3300, 550]);
    assert.equal(s.shipping.gross, 550);
    assert.equal(s.refundable, 4400);
    assert.equal(s.overpaid, 0);
  });

  it("suggests the line share per unit and the remainder for the last units", () => {
    const line = refundSummary(order()).lines[0];
    assert.equal(suggestedLineAmount(line, 1), 1100);
    assert.equal(suggestedLineAmount(line, 3), 3300);
    assert.equal(suggestedLineAmount(line, 0), 0);
  });

  it("nothing is refundable before payment is collected", () => {
    const o = order({ paymentStatus: "unpaid" });
    assert.equal(refundSummary(o).collected, false);
    assert.match(checkRefund(o, input({ other: 100 })).message ?? "", /Record the payment first/);
  });
});

describe("refund validation", () => {
  it("accepts a partial line refund and adds lines, shipping and other", () => {
    const r = checkRefund(order(), input({ lines: [{ orderItemId: "a", quantity: 1, amount: 1100 }], shipping: 550, other: 100 }));
    assert.deepEqual(r.errors, {});
    assert.equal(r.amount, 1750);
  });

  it("caps each line, shipping and the total; rejects bad quantities and empty refunds", () => {
    const o = order();
    assert.ok(checkRefund(o, input({ lines: [{ orderItemId: "a", quantity: 4, amount: 100 }] })).errors["lines.0.quantity"]);
    assert.ok(checkRefund(o, input({ lines: [{ orderItemId: "a", quantity: 1, amount: 3301 }] })).errors["lines.0.amount"]);
    assert.ok(checkRefund(o, input({ shipping: 551 })).errors.shipping);
    assert.ok(checkRefund(o, input({ other: 4401 })).errors.amount);
    assert.ok(checkRefund(o, input({ other: 1.5 })).errors.other); // whole yen
    assert.ok(checkRefund(o, input()).errors.amount);
    assert.ok(checkRefund(o, input({ other: 100, reason: "" })).errors.reason);
    assert.ok(checkRefund(o, input({ lines: [{ orderItemId: "zzz", quantity: 1, amount: 1 }] })).errors["lines.0.amount"]);
  });

  it("counts earlier refunds against the line and the total", () => {
    const prior = refund({ amount: 2200, lines: [{ orderItemId: "a", name: "a", quantity: 2, amount: 2200 }] });
    const o = order({ refunds: [prior] });
    assert.equal(o.totals.netTotal, 2200);
    const s = refundSummary(o);
    assert.equal(s.lines[0].refundedQuantity, 2);
    assert.equal(s.lines[0].maxAmount, 1100);
    assert.equal(s.refundable, 2200);
    assert.ok(checkRefund(o, input({ lines: [{ orderItemId: "a", quantity: 2, amount: 1100 }] })).errors["lines.0.quantity"]);
  });
});

describe("overpayment refunds", () => {
  it("return only money paid above the total and leave the order value unchanged", () => {
    // Paid ¥4,400, then line b removed after weighing → total ¥3,850, overpaid ¥550.
    const edited = order({ items: [item("a", 1000, 3)], payment: { method: "bank_transfer", amountPaid: 4400 } });
    assert.equal(edited.totals.total, 3850);
    assert.equal(paymentBalance(edited), -550);
    const s = refundSummary(edited);
    assert.equal(s.overpaid, 550);
    assert.equal(s.refundable, 3850);
    assert.deepEqual(checkRefund(edited, input({ kind: "overpayment", other: 550 })).errors, {});
    assert.ok(checkRefund(edited, input({ kind: "overpayment", other: 551 })).errors.other);
    assert.match(checkRefund(order(), input({ kind: "overpayment", other: 10 })).message ?? "", /not overpaid/);

    // Recorded: kept 3,850, order value unchanged, balance settled.
    const after = recalculate({ ...edited, refunds: [refund({ kind: "overpayment", amount: 550 })], payment: { ...edited.payment, amountPaid: 3850 } }, rates);
    assert.equal(after.totals.netTotal, 3850);
    assert.equal(after.totals.refundedTotal, 0);
    assert.equal(paymentBalance(after), 0);
  });

  it("an order refund lowers the value and the amount kept together, so the balance stays", () => {
    const paid = order({ payment: { method: "bank_transfer", amountPaid: 4400 } });
    const after = recalculate({ ...paid, refunds: [refund({ amount: 1100 })], payment: { ...paid.payment, amountPaid: 3300 } }, rates);
    assert.equal(after.totals.netTotal, 3300);
    assert.equal(paymentBalance(after), 0);
  });
});

describe("payment status after a refund", () => {
  it("is refunded when nothing is kept, partially refunded otherwise, paid after only an overpayment refund", () => {
    assert.equal(paymentStatusAfterRefund(0, true), "refunded");
    assert.equal(paymentStatusAfterRefund(1, true), "partially_refunded");
    assert.equal(paymentStatusAfterRefund(3850, false), "paid");
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { moneySummary } from "../src/lib/orders/money-summary.ts";

type O = Parameters<typeof moneySummary>[0];
const order = (over: Partial<O> & { total?: number; net?: number } = {}): O => {
  const total = over.total ?? 4400;
  const { net, ...rest } = over;
  delete rest.total;
  return {
    totals: { itemsSubtotal: total, discountTotal: 0, itemsTotal: total, shippingTotal: 0, taxTotal: 0, total, refundedTotal: total - (net ?? total), netTotal: net ?? total },
    adjustments: [],
    paymentStatus: "unpaid",
    payment: { method: "bank_transfer" },
    refunds: [],
    invoices: [],
    ...rest,
  } as O;
};
const adj = (before: number, after: number) => ({ id: "a", kind: "adjust", reason: "x", at: "", by: { id: "", name: "", role: "admin" }, before: { orderTotal: before }, after: { orderTotal: after } }) as never;
const refund = (amount: number, status: "recorded" | "processed" = "recorded", kind: "order" | "overpayment" = "order") => ({ id: "r", amount, status, kind, reason: "x", at: "", by: { id: "", name: "", role: "admin" } }) as never;

describe("money summary", () => {
  it("unpaid: everything is outstanding, nothing received", () => {
    const s = moneySummary(order());
    assert.deepEqual([s.original, s.current, s.received, s.outstanding, s.overpaid, s.collected], [4400, 4400, 0, 4400, 0, false]);
  });
  it("choosing a payment method is not a payment", () => {
    assert.equal(moneySummary(order({ payment: { method: "cash_on_delivery" } as never })).received, 0);
  });
  it("paid in full: nothing outstanding", () => {
    const s = moneySummary(order({ paymentStatus: "paid" }));
    assert.deepEqual([s.received, s.outstanding, s.overpaid], [4400, 0, 0]);
  });
  it("paid, then a heavier delivered weight raises the total: the difference is outstanding", () => {
    const s = moneySummary(order({ paymentStatus: "paid", total: 4620, payment: { method: "bank_transfer", amountPaid: 4400 } as never, adjustments: [adj(4400, 4620)] }));
    assert.deepEqual([s.original, s.current, s.change, s.received, s.outstanding, s.overpaid], [4400, 4620, 220, 4400, 220, 0]);
  });
  it("paid, then the total drops: overpaid, and that refund is due until recorded", () => {
    const s = moneySummary(order({ paymentStatus: "paid", total: 3850, payment: { method: "bank_transfer", amountPaid: 4400 } as never, adjustments: [adj(4400, 3850)] }));
    assert.deepEqual([s.change, s.outstanding, s.overpaid, s.refundDue, s.refundedRecorded], [-550, 0, 550, 550, 0]);
  });
  it("once the overpayment refund is recorded, nothing is due and received still shows what came in", () => {
    // As the order store records it: amount kept goes down to the new total.
    const s = moneySummary(order({ paymentStatus: "paid", total: 3850, payment: { method: "bank_transfer", amountPaid: 3850 } as never, adjustments: [adj(4400, 3850)], refunds: [refund(550, "recorded", "overpayment")] }));
    assert.deepEqual([s.received, s.refundedRecorded, s.refundDue, s.outstanding], [4400, 550, 0, 0]);
  });
  it("a recorded refund and a processed one are kept apart", () => {
    const s = moneySummary(order({ paymentStatus: "partially_refunded", net: 3400, payment: { method: "bank_transfer", amountPaid: 3400 } as never, refunds: [refund(600, "recorded"), refund(400, "processed")] }));
    assert.deepEqual([s.refundedRecorded, s.refundedProcessed, s.owed, s.received], [600, 400, 3400, 4400]);
  });
  it("a credit note is credit on paper, not a refund", () => {
    const s = moneySummary(order({ invoices: [{ kind: "invoice", snapshot: { totals: { total: 4400 } } }, { kind: "credit_note", difference: -4400, snapshot: { totals: { total: 4400 } } }] as never }));
    assert.equal(s.creditNotes, 4400);
    assert.equal(s.invoiceTotal, 4400);
    assert.equal(s.refundedRecorded + s.refundedProcessed, 0);
  });
  it("the latest invoice revision is the invoice total", () => {
    const s = moneySummary(order({ invoices: [{ kind: "invoice", snapshot: { totals: { total: 4400 } } }, { kind: "revision", difference: 220, snapshot: { totals: { total: 4620 } } }] as never }));
    assert.equal(s.invoiceTotal, 4620);
  });
  it("rounds once to the store currency's smallest unit (whole yen in the sample)", () => {
    const s = moneySummary(order({ total: 1000, paymentStatus: "paid", payment: { method: "bank_transfer", amountPaid: 1000.5 } as never }));
    assert.equal(s.overpaid, 1);
  });
});

/** Invoice documents (frozen snapshots, revisions, credit notes) and walk-in order validation. Run with `npm test`. */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CreateOrderInput, Invoice, Order } from "../src/lib/types/index.ts";
import { followUpNumber, invoiceOutdated, invoiceSnapshot, nextInvoiceKind, nextInvoiceNumber, invoiceSeller } from "../src/lib/orders/invoice.ts";
import { validateCreateOrder } from "../src/lib/validation/order.ts";

const actor = { id: "admin-1", name: "Demo admin", role: "admin" as const };
const order = (over: Partial<Order> = {}): Order =>
  ({
    id: "ord-1",
    number: "ORD-1",
    customerId: "cus-1",
    customerName: "Sample Kitchen",
    status: "received",
    statusHistory: [],
    paymentStatus: "unpaid",
    payment: { method: "cash_on_delivery" },
    items: [{ id: "oi-1", productId: "p-1", name: "Rice", sku: "R1", unitLabel: "bag", taxClass: "standard", pricedByWeight: false, quantity: 2, catalogUnitPrice: 500, unitPrice: 500, discount: 0, orderedWeight: { value: 10, unit: "kg" }, lineSubtotal: 1000, lineTotal: 1000 }],
    shipping: { label: "Route", amount: 100, taxClass: "standard" },
    taxes: [],
    totals: { itemsSubtotal: 1000, discountTotal: 0, itemsTotal: 1000, shippingTotal: 100, taxTotal: 0, total: 1100, refundedTotal: 0, netTotal: 1100 },
    refunds: [],
    notes: [],
    adjustments: [],
    createdVia: "admin",
    placedAt: "2026-10-01T10:00:00+09:00",
    updatedAt: "2026-10-01T10:00:00+09:00",
    ...over,
  }) as Order;
const issued = (o: Order, number = "INV-2026-0001", kind: Invoice["kind"] = "invoice"): Invoice => ({ id: number, number, kind, issuedAt: "2026-10-02T10:00:00+09:00", issuedBy: actor, snapshot: invoiceSnapshot(o) });

describe("invoice documents", () => {
  it("offers an invoice first, then nothing until the order changes", () => {
    const o = order();
    assert.equal(nextInvoiceKind(o), "invoice");
    const withInvoice = { ...o, invoices: [issued(o)] };
    assert.equal(invoiceOutdated(withInvoice), false);
    assert.equal(nextInvoiceKind(withInvoice), undefined);
  });

  it("needs a revision when amounts change, but not for payment status or delivery date", () => {
    const o = order();
    const inv = issued(o);
    assert.equal(nextInvoiceKind({ ...o, invoices: [inv], paymentStatus: "paid", requestedDeliveryDate: "2026-11-05T00:00:00+09:00" }), undefined);
    const changed = { ...o, invoices: [inv], totals: { ...o.totals, total: 1300 }, items: [{ ...o.items[0], quantity: 3, lineTotal: 1500 }] };
    assert.equal(nextInvoiceKind(changed), "revision");
  });

  it("freezes the snapshot: later order edits never change an issued invoice", () => {
    const o = order();
    const inv = issued(o);
    o.items[0].quantity = 99;
    assert.equal(inv.snapshot.items[0].quantity, 2);
  });

  it("offers a credit note for a cancelled, invoiced order, and nothing after it", () => {
    const o = order({ status: "cancelled" });
    assert.equal(nextInvoiceKind(o), undefined); // never invoiced → nothing to cancel
    const inv = issued(order());
    assert.equal(nextInvoiceKind({ ...o, invoices: [inv] }), "credit_note");
    assert.equal(nextInvoiceKind({ ...o, invoices: [inv, issued(o, "INV-2026-0001-CN", "credit_note")] }), undefined);
  });

  it("numbers invoices per year, revisions and credit notes from the base number", () => {
    assert.equal(nextInvoiceNumber([], 2026), "INV-2026-0001");
    assert.equal(nextInvoiceNumber(["INV-2026-0007", "INV-2026-0007-R1", "INV-2025-0040"], 2026), "INV-2026-0008");
    const docs = [{ number: "INV-2026-0007", kind: "invoice" as const }];
    assert.equal(followUpNumber(docs, "revision"), "INV-2026-0007-R1");
    assert.equal(followUpNumber([...docs, { number: "INV-2026-0007-R1", kind: "revision" }], "revision"), "INV-2026-0007-R2");
    assert.equal(followUpNumber(docs, "credit_note"), "INV-2026-0007-CN");
  });
});

describe("walk-in orders", () => {
  const base: CreateOrderInput = {
    walkIn: { name: "Karim" },
    fulfilment: "pickup",
    items: [{ productId: "p-1", quantity: 1, unitPrice: 100, discount: 0 }],
    shipping: { label: "Collected in store", amount: 0, mode: "manual", reason: "Walk-in order collected at the store" },
    paymentMethod: "cash_on_delivery",
  };
  const address = { recipientName: "Karim", country: "JP", prefecture: "Tokyo", city: "Shinjuku-ku", postalCode: "100-0001", addressLine1: "Road 1", phone: "" };

  it("needs only a name for store pickup — no email, phone or address", () => {
    assert.deepEqual(validateCreateOrder(base), {});
  });
  it("checks email and phone only when given", () => {
    const e = validateCreateOrder({ ...base, walkIn: { name: "Karim", email: "nope", phone: "123" } });
    assert.ok(e["walkIn.email"]);
    assert.ok(e["walkIn.phone"]);
    assert.deepEqual(validateCreateOrder({ ...base, walkIn: { name: "Karim", email: "karim@example.com", phone: "09012345678" } }), {});
  });
  it("requires a name", () => {
    assert.ok(validateCreateOrder({ ...base, walkIn: { name: " " } })["walkIn.name"]);
  });
  it("walk-in delivery needs an address but not a phone", () => {
    assert.ok(validateCreateOrder({ ...base, fulfilment: "delivery" })["shippingAddress.addressLine1"]);
    assert.deepEqual(validateCreateOrder({ ...base, fulfilment: "delivery", shippingAddress: address, billingAddress: address }), {});
  });
  it("store pickup is only for walk-in orders, and registered customers still need a phone", () => {
    const reg: CreateOrderInput = { ...base, walkIn: undefined, customerId: "cus-1" };
    assert.ok(validateCreateOrder(reg).fulfilment);
    assert.ok(validateCreateOrder({ ...reg, fulfilment: "delivery", shippingAddress: address, billingAddress: address })["shippingAddress.phone"]);
  });
});

describe("invoice seller", () => {
  const settings = { legalName: "Example Ltd", registrationNumber: "R1", taxNumber: "T1", documents: { showRegistrationOnInvoice: true, showTaxNumberOnInvoice: false } } as never;
  const store = { storeName: "Example", phone: "03", email: "a@b.c", address: { addressLine1: "1 Main St", city: "Tokyo", postalCode: "100-0001" } } as never;
  it("follows the document settings", () => {
    const s = invoiceSeller(settings, store);
    assert.equal(s.name, "Example Ltd");
    assert.equal(s.registrationNumber, "R1");
    assert.equal(s.taxNumber, undefined);
    assert.deepEqual(s.addressLines, ["1 Main St", "Tokyo, 100-0001"]);
    assert.equal(s.contact, "03 · a@b.c");
  });
});

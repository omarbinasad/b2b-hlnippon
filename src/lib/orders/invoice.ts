/**
 * Invoice rules (pure; tested in tests/invoices.test.ts). An issued invoice is a frozen snapshot of the order.
 * It is never rewritten: when the order changes afterwards a revision replaces it, and a cancelled order gets a
 * credit note. Numbers: "INV-<year>-<4-digit sequence>", revisions "<number>-R<n>", credit notes "<number>-CN".
 */
import type { CompanySettings, Invoice, InvoiceKind, InvoiceSeller, InvoiceSnapshot, Order, StoreSettings } from "@/lib/types";

/** The seller as an invoice prints them, following the company's document settings. */
export function invoiceSeller(settings: Pick<CompanySettings, "legalName" | "registrationNumber" | "taxNumber" | "documents">, store: Pick<StoreSettings, "storeName" | "address" | "phone" | "email">): InvoiceSeller {
  const a = store.address;
  const line = [a.area, a.city, a.postalCode].filter(Boolean).join(", ");
  const contact = [store.phone, store.email].filter(Boolean).join(" · ");
  return {
    name: settings.legalName || store.storeName,
    addressLines: [a.addressLine1, a.addressLine2, line].filter((x): x is string => !!x),
    contact: contact || undefined,
    registrationNumber: settings.documents.showRegistrationOnInvoice ? settings.registrationNumber || undefined : undefined,
    taxNumber: settings.documents.showTaxNumberOnInvoice ? settings.taxNumber || undefined : undefined,
  };
}

/** The order as an invoice shows it, frozen at issue time. */
export function invoiceSnapshot(order: Order): InvoiceSnapshot {
  return structuredClone({
    orderNumber: order.number,
    placedAt: order.placedAt,
    customerName: order.customerName,
    walkIn: order.walkIn,
    customerEmail: order.customerEmail,
    customerPhone: order.customerPhone,
    billingAddress: order.billingAddress,
    shippingAddress: order.shippingAddress,
    fulfilment: order.fulfilment,
    requestedDeliveryDate: order.requestedDeliveryDate,
    items: order.items,
    coupon: order.coupon,
    discount: order.discount ? { type: order.discount.type, value: order.discount.value } : undefined,
    shipping: { label: order.shipping.label, amount: order.shipping.amount },
    taxes: order.taxes,
    totals: order.totals,
    paymentMethod: order.payment.method,
    paymentStatus: order.paymentStatus,
    amountPaid: order.payment.amountPaid,
  });
}

/** The parts that make an issued invoice out of date when they change (not payment status or the delivery date). */
function billable(s: InvoiceSnapshot) {
  return JSON.stringify([
    s.customerName,
    s.billingAddress && { ...s.billingAddress, id: undefined },
    s.items.map((i) => [i.productId, i.variationId, i.name, i.quantity, i.unitPrice, i.discount, i.fulfilledWeight, i.lineTotal]),
    s.discount,
    s.shipping.amount,
    s.taxes.map((t) => [t.taxClass, t.rate, t.taxAmount]),
    s.totals.total,
  ]);
}

export const latestInvoice = (order: Pick<Order, "invoices">): Invoice | undefined => order.invoices?.at(-1);

/** True when the latest issued document no longer matches the order's amounts or billing details. */
export function invoiceOutdated(order: Order): boolean {
  const last = latestInvoice(order);
  return Boolean(last && last.kind !== "credit_note" && billable(last.snapshot) !== billable(invoiceSnapshot(order)));
}

/** Which document can be issued next, if any. */
export function nextInvoiceKind(order: Order): InvoiceKind | undefined {
  const last = latestInvoice(order);
  if (!last) return order.status === "cancelled" ? undefined : "invoice";
  if (last.kind === "credit_note") return undefined;
  if (order.status === "cancelled") return "credit_note";
  return invoiceOutdated(order) ? "revision" : undefined;
}

/** Next base number for a year, after the highest existing "INV-<year>-NNNN" (revisions and credit notes share their base). */
export function nextInvoiceNumber(existing: string[], year: number, base = "INV"): string {
  const prefix = `${base}-${year}-`;
  const max = Math.max(0, ...existing.filter((n) => n.startsWith(prefix)).map((n) => Number(n.slice(prefix.length, prefix.length + 4)) || 0));
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}

/** Number for a document on an order that already has invoices: "<base>-R<n>" or "<base>-CN". */
export function followUpNumber(invoices: Pick<Invoice, "number" | "kind">[], kind: Exclude<InvoiceKind, "invoice">): string {
  const base = invoices[0].number;
  if (kind === "credit_note") return `${base}-CN`;
  return `${base}-R${invoices.filter((i) => i.kind === "revision").length + 1}`;
}

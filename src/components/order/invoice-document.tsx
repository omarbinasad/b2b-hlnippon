import { siteConfig } from "@/config/site";
import { invoiceSeller } from "@/lib/orders/invoice";
import { cx } from "@/lib/cx";
import { formatAddressLines, formatDate, formatDateTime, formatMoney, formatWeight } from "@/lib/format";
import { fromMinor, toMinor } from "@/lib/orders/calc";
import { paymentMethodLabels, paymentStatusLabels } from "@/lib/orders/status";
import Image from "next/image";
import { company } from "@/config/runtime";
import type { Address, CompanySettings, Invoice, InvoiceKind, InvoiceSnapshot, StoreSettings } from "@/lib/types";
import { variationLabel } from "./order-details";

const titles: Record<InvoiceKind, string> = { invoice: "Invoice", revision: "Revised invoice", credit_note: "Credit note" };

function AddressLines({ address }: { address: Address }) {
  return (
    <>
      {address.companyName && <p>{address.companyName}</p>}
      <p>{address.recipientName}</p>
      {formatAddressLines(address).map((l) => <p key={l}>{l}</p>)}
      {address.phone && <p>{address.phone}</p>}
    </>
  );
}

/**
 * Printable invoice, revision or credit note — from an issued document's frozen snapshot, or a draft of the
 * current order when nothing has been issued. Shared by the admin and customer invoice pages. Only the element
 * marked `data-invoice` prints (see globals.css).
 */
export function InvoiceDocument({ invoice, draft, store, settings = company() }: { invoice?: Invoice; draft?: InvoiceSnapshot; store: StoreSettings; /** Defaults to the current company settings; the settings page passes its unsaved draft. */ settings?: Pick<CompanySettings, "legalName" | "registrationNumber" | "taxNumber" | "documents" | "branding"> }) {
  const docs = settings.documents;
  const logo = settings.branding.logoLight ?? settings.branding.logoMain;
  const s = invoice?.snapshot ?? draft!;
  // An issued document keeps the details it was issued with.
  const seller = s.seller ?? invoiceSeller(settings, { ...store, storeName: store.storeName || siteConfig.name });
  const t = s.totals;
  const orderDiscount = t.orderDiscount ?? 0;
  const lineDiscounts = fromMinor(toMinor(t.discountTotal) - toMinor(orderDiscount));
  const balance = s.amountPaid !== undefined ? fromMinor(toMinor(t.netTotal) - toMinor(s.amountPaid)) : undefined;
  const credit = invoice?.kind === "credit_note";
  const row = "flex justify-between gap-4";

  return (
    <article data-invoice className="rounded-ui border border-line bg-surface p-5 text-sm sm:p-8">
      <p className="mb-5 rounded-ui bg-warning-soft px-3 py-2 text-xs text-warning">
        Demo document — not a valid tax invoice. Prices come from demo data and tax rates are fictional.
      </p>

      <header className="flex flex-wrap items-start justify-between gap-6">
        <div>
          {docs.showLogoOnInvoice && logo && <Image src={logo.url} alt="" width={Math.round((48 * logo.width) / logo.height)} height={48} unoptimized={logo.url.startsWith("/media/")} className="mb-2 h-12 w-auto" />}
          <p className="text-lg font-semibold">{seller.name}</p>
          <div className="mt-1 text-muted">
            {seller.addressLines.map((l) => <p key={l}>{l}</p>)}
            {seller.contact && <p>{seller.contact}</p>}
            {seller.registrationNumber && <p>Registration no. {seller.registrationNumber}</p>}
            {seller.taxNumber && <p>Tax no. {seller.taxNumber}</p>}
          </div>
        </div>
        <div className="text-right">
          <h1 className="text-xl font-semibold">{invoice ? (invoice.kind === "invoice" && docs.invoiceTitle ? docs.invoiceTitle : titles[invoice.kind]) : `Draft ${(docs.invoiceTitle ?? "invoice").toLowerCase()}`}</h1>
          {invoice ? (
            <>
              <p className="font-medium tabular-nums">{invoice.number}</p>
              <p className="text-muted">Issued {formatDateTime(invoice.issuedAt)}</p>
              {invoice.replaces && <p className="text-muted">{credit ? "Cancels" : "Replaces"} {invoice.replaces}</p>}
            </>
          ) : (
            <p className="text-muted">Not issued — the current order, for review</p>
          )}
        </div>
      </header>

      <section className="mt-6 grid gap-6 sm:grid-cols-3">
        <div>
          <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">Bill to</h2>
          <div className="mt-1">
            <p className="font-medium">{s.walkIn ? s.walkIn.name : s.customerName}</p>
            {s.walkIn?.companyName && <p>{s.walkIn.companyName}</p>}
            {s.billingAddress && <AddressLines address={s.billingAddress} />}
            {s.customerEmail && <p className="break-all">{s.customerEmail}</p>}
            {s.customerPhone && <p>{s.customerPhone}</p>}
          </div>
        </div>
        <div>
          <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">{s.fulfilment === "pickup" ? "Fulfilment" : "Deliver to"}</h2>
          <div className="mt-1">{s.shippingAddress ? <AddressLines address={s.shippingAddress} /> : <p>Collected in store</p>}</div>
        </div>
        <dl className="space-y-1 [&>div]:flex [&>div]:justify-between [&>div]:gap-3">
          <div><dt className="text-muted">Order</dt><dd className="tabular-nums">{s.orderNumber}</dd></div>
          <div><dt className="text-muted">Placed</dt><dd>{formatDate(s.placedAt)}</dd></div>
          {s.requestedDeliveryDate && <div><dt className="text-muted">Delivery</dt><dd>{formatDate(s.requestedDeliveryDate)}</dd></div>}
          <div><dt className="text-muted">Payment</dt><dd className="text-right">{paymentMethodLabels[s.paymentMethod]}</dd></div>
          <div><dt className="text-muted">Status</dt><dd>{paymentStatusLabels[s.paymentStatus]}</dd></div>
        </dl>
      </section>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[36rem] border-collapse text-left">
          <caption className="sr-only">Invoice items</caption>
          <thead>
            <tr className="border-b border-line text-xs text-muted">
              <th scope="col" className="py-2 pr-3 font-medium">Item</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">Qty</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">Unit price</th>
              <th scope="col" className="px-3 py-2 font-medium">Weight (ordered → delivered)</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">Discount</th>
              <th scope="col" className="py-2 pl-3 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {s.items.map((i) => (
              <tr key={i.id} className="border-b border-line align-top">
                <td className="py-2 pr-3">
                  <p className="font-medium">{i.name}</p>
                  <p className="text-xs text-muted">{[variationLabel(i.attributes), i.sku, `per ${i.unitLabel}`].filter(Boolean).join(" · ")}</p>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{i.quantity}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">{formatMoney(i.unitPrice)}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {formatWeight(i.orderedWeight)}
                  {i.fulfilledWeight && <> → <strong>{formatWeight(i.fulfilledWeight)}</strong></>}
                  {i.pricedByWeight && <span className="block text-xs text-muted">charged by {i.fulfilledWeight ? "delivered" : "ordered"} weight</span>}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{i.discount ? `−${formatMoney(i.discount)}` : "—"}</td>
                <td className="py-2 pl-3 text-right font-medium whitespace-nowrap tabular-nums">{formatMoney(i.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 sm:ml-auto sm:max-w-sm">
        <dl className="space-y-1.5 [&_dd]:tabular-nums">
          <div className={row}><dt>Items</dt><dd>{formatMoney(t.itemsSubtotal)}</dd></div>
          {lineDiscounts > 0 && <div className={row}><dt>{s.coupon ? `Coupon ${s.coupon.code}` : "Item discounts"}</dt><dd>−{formatMoney(lineDiscounts)}</dd></div>}
          {orderDiscount > 0 && (
            <div className={row}>
              <dt>Order discount{s.discount?.type === "percent" ? ` (${s.discount.value}%)` : ""}</dt>
              <dd>−{formatMoney(orderDiscount)}</dd>
            </div>
          )}
          <div className={row}><dt>{s.shipping.label}</dt><dd>{t.shippingTotal ? formatMoney(t.shippingTotal) : "Free"}</dd></div>
          {s.taxes.map((tax) => (
            <div key={tax.rateId ?? tax.taxClass} className={row}>
              <dt className="text-muted">{tax.rateName ?? `Tax (${tax.taxClass})`} {tax.rate}% (fictional){t.taxIncluded ? " included" : ""} on {formatMoney(tax.taxableAmount)}</dt>
              <dd>{formatMoney(tax.taxAmount)}</dd>
            </div>
          ))}
          <div className={cx(row, "border-t border-line pt-2 text-base font-semibold")}><dt>Total</dt><dd>{formatMoney(t.total)}</dd></div>
          {t.refundedTotal > 0 && <div className={row}><dt>Refunded</dt><dd>−{formatMoney(t.refundedTotal)}</dd></div>}
          {balance !== undefined && (
            <>
              <div className={row}><dt className="text-muted">Already paid</dt><dd>{formatMoney(s.amountPaid!)}</dd></div>
              {balance !== 0 && <div className={cx(row, "font-semibold")}><dt>{balance > 0 ? "Balance due" : "Overpaid (refund due)"}</dt><dd>{formatMoney(Math.abs(balance))}</dd></div>}
            </>
          )}
          {invoice?.difference !== undefined && (
            <div className={cx(row, "border-t border-line pt-2 font-semibold")}>
              <dt>{credit ? `Credited (cancels ${invoice.replaces})` : `Change from ${invoice.replaces}`}</dt>
              <dd>{invoice.difference > 0 ? "+" : invoice.difference < 0 ? "−" : ""}{formatMoney(Math.abs(invoice.difference))}</dd>
            </div>
          )}
        </dl>
      </div>

      {docs.invoiceHeaderNote && <p className="mt-4 text-xs text-muted">{docs.invoiceHeaderNote}</p>}
      {docs.invoiceFooter && <p className="mt-4 border-t border-line pt-3 text-xs whitespace-pre-line text-muted">{docs.invoiceFooter}</p>}
      {invoice?.reason && (
        <p className="mt-4 text-xs text-muted">{credit ? "Reason for credit" : "Reason for revision"}: {invoice.reason}</p>
      )}
      {credit && <p className="mt-2 text-xs text-muted">The order was cancelled. This credit note cancels {invoice.replaces}; the amounts above are the cancelled invoice&apos;s.</p>}
    </article>
  );
}

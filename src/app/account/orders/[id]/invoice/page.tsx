import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { InvoiceDocument } from "@/components/order/invoice-document";
import { PrintButton } from "@/components/order/print-button";
import { Notice } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { getPortalCustomerId } from "@/lib/auth/session";
import { repositories } from "@/lib/data";
import { formatDate } from "@/lib/format";
import { latestInvoice } from "@/lib/orders/invoice";

const kindLabel = { invoice: "Invoice", revision: "Revised invoice", credit_note: "Credit note" } as const;

export const metadata: Metadata = { title: "Invoice" };

/** The customer's issued invoices for one order (drafts are never shown to customers). */
export default async function CustomerInvoicePage({ params, searchParams }: PageProps<"/account/orders/[id]/invoice">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const [order, store] = await Promise.all([repositories.orders.getById(id, await getPortalCustomerId()), repositories.settings.getStore()]);
  if (!order) notFound();

  const invoices = order.invoices ?? [];
  const shown = (typeof sp.doc === "string" ? invoices.find((i) => i.number === sp.doc) : undefined) ?? latestInvoice(order);

  return (
    <>
      <Link href={`/account/orders/${order.id}`} className="text-sm text-muted hover:text-foreground">← Order {order.number}</Link>
      <PageHeader title={`Invoice · ${order.number}`} actions={shown ? <PrintButton /> : undefined} />
      {!shown ? (
        <Notice tone="info">No invoice has been issued for this order yet.</Notice>
      ) : (
        <>
          {invoices.length > 1 && (
            <nav aria-label="Invoice documents" className="mb-4 flex flex-wrap gap-2 text-sm">
              {invoices.map((inv) => (
                <Link
                  key={inv.id}
                  href={`/account/orders/${order.id}/invoice?doc=${encodeURIComponent(inv.number)}` as Route}
                  aria-current={inv.id === shown.id ? "page" : undefined}
                  className="rounded-ui border border-line px-3 py-1.5 hover:bg-surface-muted aria-[current=page]:border-brand aria-[current=page]:bg-brand-soft"
                >
                  <span className="font-medium tabular-nums">{inv.number}</span> · {kindLabel[inv.kind]} · {formatDate(inv.issuedAt)}
                </Link>
              ))}
            </nav>
          )}
          {shown.id !== latestInvoice(order)!.id && (
            <div className="mb-4"><Notice tone="info">This document was replaced by {latestInvoice(order)!.number}.</Notice></div>
          )}
          <InvoiceDocument invoice={shown} store={store} />
        </>
      )}
    </>
  );
}

import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { InvoiceActions } from "@/components/admin/orders/invoice-actions";
import { InvoiceDocument } from "@/components/order/invoice-document";
import { PrintButton } from "@/components/order/print-button";
import { Badge } from "@/components/ui/badge";
import { Notice } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { repositories } from "@/lib/data";
import { formatDateTime, formatMoney } from "@/lib/format";
import { invoiceOutdated, invoiceSnapshot, latestInvoice, nextInvoiceKind } from "@/lib/orders/invoice";

const kindLabel = { invoice: "Invoice", revision: "Revision", credit_note: "Credit note" } as const;

export async function generateMetadata({ params }: PageProps<"/admin/orders/[id]/invoice">): Promise<Metadata> {
  const order = await repositories.orders.getById((await params).id);
  return { title: order ? `Invoice · ${order.number}` : "Order not found" };
}

export default async function AdminInvoicePage({ params, searchParams }: PageProps<"/admin/orders/[id]/invoice">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const [order, store] = await Promise.all([repositories.orders.getById(id), repositories.settings.getStore()]);
  if (!order) notFound();

  const invoices = order.invoices ?? [];
  const requested = typeof sp.doc === "string" ? invoices.find((i) => i.number === sp.doc) : undefined;
  const shown = requested ?? latestInvoice(order);
  const next = nextInvoiceKind(order);
  const outdated = invoiceOutdated(order);

  return (
    <>
      <Link href={`/admin/orders/${order.id}`} className="text-sm text-muted hover:text-foreground">← Order {order.number}</Link>
      <PageHeader
        title={`Invoice · ${order.number}`}
        description="Issued invoices are frozen. If the order changes, issue a revision; for a cancelled order, a credit note. Nothing is ever overwritten."
        actions={
          <>
            {next && <InvoiceActions orderId={order.id} kind={next} />}
            <PrintButton />
          </>
        }
      />

      <div className="mb-4 space-y-3">
        {!shown && <Notice tone="info">No invoice issued yet. Below is a draft of the current order — issue the invoice to give it a number.</Notice>}
        {outdated && order.status !== "cancelled" && (
          <Notice tone="warning" title="The order changed after the last invoice">
            {latestInvoice(order)!.number} no longer matches the order&apos;s amounts. Issue a revised invoice so the customer gets the correct document.
          </Notice>
        )}
        {next === "credit_note" && <Notice tone="warning">This order is cancelled but its invoice is still open. Issue a credit note to cancel it.</Notice>}
      </div>

      {invoices.length > 0 && (
        <nav aria-label="Invoice documents" className="mb-4 flex flex-wrap gap-2">
          {invoices.map((inv) => (
            <Link
              key={inv.id}
              href={`/admin/orders/${order.id}/invoice?doc=${encodeURIComponent(inv.number)}` as Route}
              aria-current={inv.id === shown?.id ? "page" : undefined}
              className="rounded-ui border border-line px-3 py-1.5 text-sm hover:bg-surface-muted aria-[current=page]:border-brand aria-[current=page]:bg-brand-soft"
            >
              <span className="font-medium tabular-nums">{inv.number}</span>{" "}
              <Badge tone={inv.kind === "credit_note" ? "danger" : inv.kind === "revision" ? "warning" : "neutral"}>{kindLabel[inv.kind]}</Badge>
              <span className="block text-xs text-muted">
                {formatDateTime(inv.issuedAt)} · {inv.issuedBy.name}
                {inv.difference !== undefined && ` · ${inv.difference >= 0 ? "+" : "−"}${formatMoney(Math.abs(inv.difference))}`}
              </span>
            </Link>
          ))}
        </nav>
      )}

      {shown ? <InvoiceDocument invoice={shown} store={store} /> : <InvoiceDocument draft={invoiceSnapshot(order)} store={store} />}
    </>
  );
}

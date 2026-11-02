import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReorderButton } from "@/components/order/reorder-button";
import { AddressBlock, OrderItemsTable, OrderTotalsList, StatusProgress } from "@/components/order/order-details";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { getPortalCustomerId } from "@/lib/auth/session";
import { repositories } from "@/lib/data";
import { formatDate, formatDateTime } from "@/lib/format";
import { paymentMethodLabels } from "@/lib/orders/status";

export const metadata: Metadata = { title: "Order details" };

export default async function AccountOrderPage({ params, searchParams }: PageProps<"/account/orders/[id]">) {
  const { id } = await params;
  const placed = (await searchParams).placed === "1";
  // Scoped to the current customer so one customer cannot open another's order.
  const order = await repositories.orders.getById(id, await getPortalCustomerId());
  if (!order) notFound();

  // Only customer-visible notes; internal admin notes must never reach the portal
  // (the real backend must filter these server-side as well).
  const notes = order.notes.filter((n) => n.type === "customer");

  return (
    <>
      <Link href="/account/orders" className="text-sm text-muted hover:text-foreground">← All orders</Link>
      <PageHeader
        title={`Order ${order.number}`}
        description={`Placed ${formatDateTime(order.placedAt)}`}
        actions={
          <>
            <OrderStatusBadge status={order.status} />
            <PaymentStatusBadge status={order.paymentStatus} />
            {order.invoices?.length ? (
              <Link href={`/account/orders/${order.id}/invoice`} className={buttonClasses({ variant: "secondary", size: "sm" })}>
                Invoice {order.invoices.at(-1)!.number}
              </Link>
            ) : null}
            <ReorderButton orderId={order.id} />
          </>
        }
      />

      {placed && (
        <div className="mb-6">
          <Notice tone="success" title="Thank you — your order has been received">
            We&apos;ll confirm the delivery date and let you know when it&apos;s on the way. No payment was taken online.
            Demo: this order exists on the demo server only.
          </Notice>
        </div>
      )}

      <Card className="mb-6">
        <StatusProgress order={order} />
      </Card>

      <OrderItemsTable items={order.items} />
      {order.adjustments.length > 0 && (
        <p className="mt-2 text-xs text-muted">
          This order was updated after it was placed (for example packed weights, prices, items, a discount or the delivery date). Line totals and the summary show the current amounts.
        </p>
      )}

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Card title="Delivery">
          {order.shippingAddress ? <AddressBlock address={order.shippingAddress} /> : <p className="text-sm">Collected in store.</p>}
          <p className="mt-3 text-sm text-muted">
            {order.shipping.label}
            {order.requestedDeliveryDate && ` · requested ${formatDate(order.requestedDeliveryDate)}`}
          </p>
          {order.customerNote && <p className="mt-2 text-sm">Your note: {order.customerNote}</p>}
        </Card>

        <Card title="Summary">
          <OrderTotalsList order={order} />
          <p className="mt-3 text-sm text-muted">
            Payment: {paymentMethodLabels[order.payment.method]}
            {order.payment.reference && ` · ref ${order.payment.reference}`}
          </p>
        </Card>

        {notes.length > 0 && (
          <Card title="Messages from us" className="md:col-span-2">
            <ul className="space-y-3 text-sm">
              {notes.map((n) => (
                <li key={n.id}>
                  <p>{n.body}</p>
                  <p className="text-xs text-muted">{formatDateTime(n.at)}</p>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </>
  );
}

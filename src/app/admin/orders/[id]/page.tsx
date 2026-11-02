import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionNotice, DemoEditingNotice } from "@/components/admin/demo-notice";
import { AddOrderNote } from "@/components/admin/orders/add-note";
import { AdjustItemButton } from "@/components/admin/orders/adjust-item";
import { DeliveryDateEditor } from "@/components/admin/orders/delivery-date";
import { AddItemButton, RemoveItemButton } from "@/components/admin/orders/item-edit";
import { LineStockControl } from "@/components/admin/orders/line-stock";
import { OrderAddressEditButton } from "@/components/admin/orders/order-address-edit";
import { OrderDiscountButton } from "@/components/admin/orders/order-discount";
import { RecordPaymentButton } from "@/components/admin/orders/record-payment";
import { RefundButton } from "@/components/admin/orders/refund-dialog";
import { ShippingChargeButton } from "@/components/admin/orders/shipping-charge";
import { OrderStatusControls } from "@/components/admin/orders/status-controls";
import { AddressBlock, OrderItemsTable, OrderTotalsList, StatusHistoryList, StatusProgress } from "@/components/order/order-details";
import { Badge, OrderStatusBadge, PaymentStatusBadge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { Table } from "@/components/ui/table";
import { repositories } from "@/lib/data";
import { formatDate, formatDateTime, formatMoney, formatWeight } from "@/lib/format";
import { paymentBalance } from "@/lib/orders/assemble";
import { isOrderRefund, refundSummary } from "@/lib/orders/refund";
import { isOutOfStock, lineStock } from "@/lib/orders/stock";
import { canAdjust, canChangeDeliveryDate, canChangeDiscount, canEditItems, paymentMethodLabels } from "@/lib/orders/status";
import type { OrderAdjustment, OrderChangeValues } from "@/lib/types";
import { siteConfig } from "@/config/site";

const changeLabels: Record<OrderAdjustment["kind"], string> = {
  adjust: "Item adjusted",
  add: "Item added",
  remove: "Item removed",
  replace: "Item replaced",
  discount: "Order discount",
  delivery_date: "Delivery date",
  address: "Address changed",
  shipping: "Delivery charge",
};

const day = (d?: string | null) => (d ? formatDate(`${d}T00:00:00${siteConfig.utcOffset}`) : "not set");

/** One-line summary of what a change did (only the fields it touched). */
function describeChange(a: OrderAdjustment): string {
  const b = a.before;
  const n = a.after;
  const line = (v: OrderChangeValues) => `${v.quantity} × ${formatMoney(v.unitPrice ?? 0)} = ${formatMoney(v.lineTotal ?? 0)}`;
  const disc = (d?: OrderChangeValues["discount"]) => (d ? (d.type === "percent" ? `${d.value}%` : formatMoney(d.value)) : "none");
  switch (a.kind) {
    case "add":
      return `Added ${line(n)}`;
    case "remove":
      return `Removed ${line(b)}`;
    case "replace":
      return `${a.replacedItemName}: ${line(b)} → ${line(n)}`;
    case "discount":
      return `${disc(b.discount)} → ${disc(n.discount)}`;
    case "delivery_date":
      return `${day(b.deliveryDate)} → ${day(n.deliveryDate)}`;
    case "address":
      return `${a.addressType === "billing" ? "Billing" : "Delivery"}: ${b.address ?? "none"} → ${n.address ?? "none"}`;
    case "shipping":
      return `${b.shippingLabel} ${formatMoney(b.shipping ?? 0)} → ${n.shippingLabel} ${formatMoney(n.shipping ?? 0)}`;
    default: {
      const parts: string[] = [];
      const pair = (label: string, x?: string, y?: string) => {
        if (x !== y) parts.push(`${label} ${x ?? "—"} → ${y ?? "—"}`);
      };
      if (b.quantity !== undefined) pair("Qty", String(b.quantity), String(n.quantity));
      pair("Unit price", b.unitPrice !== undefined ? formatMoney(b.unitPrice) : undefined, n.unitPrice !== undefined ? formatMoney(n.unitPrice) : undefined);
      pair("Packed", b.fulfilledWeight && formatWeight(b.fulfilledWeight), n.fulfilledWeight && formatWeight(n.fulfilledWeight));
      if (b.lineTotal !== undefined && n.lineTotal !== undefined) pair("Line", formatMoney(b.lineTotal), formatMoney(n.lineTotal));
      return parts.join(" · ");
    }
  }
}

export async function generateMetadata({ params }: PageProps<"/admin/orders/[id]">): Promise<Metadata> {
  const order = await repositories.orders.getById((await params).id);
  return { title: order ? `Order ${order.number}` : "Order not found" };
}

export default async function AdminOrderPage({ params, searchParams }: PageProps<"/admin/orders/[id]">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const [order, settings] = await Promise.all([repositories.orders.getById(id), repositories.orders.calculationSettings()]);
  if (!order) notFound();

  const adjustable = canAdjust(order.status);
  const editable = canEditItems(order.status);
  const forPreview = { items: order.items, shipping: order.shipping, refunds: order.refunds, taxSnapshot: order.taxSnapshot, discount: order.discount };
  // Live catalog stock per line (orders keep snapshots; stock is never stored on the order).
  const productIds = [...new Set(order.items.map((i) => i.productId))];
  const found = await Promise.all(productIds.map((pid) => repositories.products.getById(pid)));
  const products = new Map(productIds.map((pid, i) => [pid, found[i]]));
  const stockFor = (item: (typeof order.items)[number]) => lineStock(products.get(item.productId), item.variationId);
  const unavailable =
    order.status === "delivered" || order.status === "cancelled"
      ? []
      : order.items.filter((i) => {
          const s = stockFor(i);
          return !s || isOutOfStock(s.stock) || Boolean(s.unavailable);
        });
  const balance = paymentBalance(order);
  const refunds = refundSummary(order);
  const customer = order.customerId ? await repositories.customers.getById(order.customerId) : null;
  const savedAddresses = customer?.addresses ?? [];
  const pickup = order.fulfilment === "pickup";
  const itemName = new Map(order.items.map((i) => [i.id, i.name]));
  const notice = typeof sp.notice === "string" ? sp.notice : undefined;

  return (
    <>
      <Link href="/admin/orders" className="text-sm text-muted hover:text-foreground">← All orders</Link>
      <PageHeader
        title={`Order ${order.number}`}
        description={`Placed ${formatDateTime(order.placedAt)} · ${order.createdVia === "admin" ? `created by ${order.createdBy?.name ?? "an admin"}` : "placed in the store"}${order.legacyWooId ? ` · legacy #${order.legacyWooId}` : ""}`}
        actions={
          <>
            <OrderStatusBadge status={order.status} />
            <PaymentStatusBadge status={order.paymentStatus} />
            <Link href={`/admin/orders/${order.id}/invoice`} className={buttonClasses({ variant: "secondary", size: "sm" })}>
              Invoice{order.invoices?.length ? ` (${order.invoices.at(-1)!.number})` : ""}
            </Link>
          </>
        }
      />
      <ActionNotice notice={notice} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-6">
          <Card title="Delivery progress">
            <StatusProgress order={order} />
            <div className="mt-4">
              <OrderStatusControls orderId={order.id} status={order.status} />
            </div>
          </Card>

          <Card
            title="Items"
            description={
              editable
                ? "Add or remove items, or use Adjust to change a quantity, the packed weight or the agreed price. Catalog prices are not changed."
                : adjustable
                  ? "Use Adjust for packed weights or agreed prices. Items can't be added or removed after delivery."
                  : undefined
            }
            actions={editable ? <AddItemButton orderId={order.id} customerId={order.customerId} excludeIds={[]} /> : undefined}
          >
            {unavailable.length > 0 && (
              <div className="mb-4">
                <Notice tone="warning" title={unavailable.length === 1 ? "1 item is now unavailable" : `${unavailable.length} items are now unavailable`}>
                  {unavailable.map((i) => i.name).join(", ")}: stock changed after this order was placed. Replace or remove {unavailable.length === 1 ? "it" : "them"}, or mark back in stock if that was a mistake. The order is not changed automatically.
                </Notice>
              </div>
            )}
            <OrderItemsTable
              items={order.items}
              showPricing
              renderDetails={(item) => (
                <LineStockControl orderId={order.id} productId={item.productId} variationId={item.variationId} itemName={item.name} info={stockFor(item)} />
              )}
              renderAction={
                adjustable
                  ? (item, index) => (
                      <>
                        <AdjustItemButton orderId={order.id} item={item} index={index} order={forPreview} taxRates={settings.taxRates} allowQuantity={editable} />
                        {editable && <RemoveItemButton orderId={order.id} item={item} lastItem={order.items.length === 1} />}
                      </>
                    )
                  : undefined
              }
            />
            {editable && (
              <div className="mt-3 rounded-ui border border-dashed border-line p-2">
                <AddItemButton orderId={order.id} customerId={order.customerId} excludeIds={[]} variant="ghost" label="Add new item to this order" />
              </div>
            )}
            {canChangeDiscount(order.status) && (
              <div className="mt-4 flex justify-end">
                <OrderDiscountButton orderId={order.id} current={order.discount} amount={order.totals.orderDiscount} />
              </div>
            )}
            <div className="mt-4 sm:ml-auto sm:max-w-sm">
              <OrderTotalsList
                order={order}
                vatNote={
                  order.taxSnapshot
                    ? `Tax from this order's snapshot (${order.taxSnapshot.enabled ? (order.taxSnapshot.pricesIncludeTax ? "prices include tax" : "tax added to prices") : "tax was off"}; shipping ${order.taxSnapshot.shippingTaxable ? "taxable" : "not taxed"}), captured ${formatDateTime(order.taxSnapshot.capturedAt)}. Fictional demo rates; editing rates never changes this order.`
                    : "Older order: tax uses the placeholder per-class rates it was created with."
                }
              />
            </div>
          </Card>

          <Card title="Change history" description="Every admin change to items, prices, weights, the order discount, delivery charge, addresses and delivery date.">
            {order.adjustments.length ? (
              <Table caption="Change history" density="compact">
                <thead>
                  <tr>
                    <th scope="col">When / who</th>
                    <th scope="col">Change</th>
                    <th scope="col" className="text-right">Order total</th>
                  </tr>
                </thead>
                <tbody>
                  {[...order.adjustments].reverse().map((a) => (
                    <tr key={a.id}>
                      <td className="whitespace-nowrap">
                        {formatDateTime(a.at)}
                        <span className="block text-xs text-muted">{a.by.name}</span>
                      </td>
                      <td className="min-w-56">
                        <span className="font-medium">{changeLabels[a.kind]}</span>
                        {a.itemName && <> — {a.itemName}</>}
                        <span className="block text-xs tabular-nums">{describeChange(a)}</span>
                        {a.reason && <span className="block text-xs text-muted">“{a.reason}”</span>}
                      </td>
                      <td className="text-right whitespace-nowrap tabular-nums">{formatMoney(a.before.orderTotal)} → {formatMoney(a.after.orderTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : (
              <p className="text-sm text-muted">No changes since the order was placed.</p>
            )}
          </Card>

          <Card title="Notes">
            {order.customerNote && (
              <div className="mb-4 rounded-ui bg-surface-muted p-3 text-sm">
                <p className="text-xs font-medium text-muted">Customer&apos;s order note</p>
                <p className="mt-1">{order.customerNote}</p>
              </div>
            )}
            {order.notes.length > 0 && (
              <ul className="mb-5 space-y-3">
                {[...order.notes].reverse().map((n) => (
                  <li key={n.id} className="text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={n.type === "customer" ? "info" : "neutral"}>{n.type === "customer" ? "Visible to customer" : "Internal"}</Badge>
                      <span className="text-xs text-muted">{formatDateTime(n.at)} · {n.by.name}</span>
                    </div>
                    <p className="mt-1">{n.body}</p>
                  </li>
                ))}
              </ul>
            )}
            <AddOrderNote orderId={order.id} />
          </Card>
        </div>

        <div className="min-w-0 space-y-6">
          <Card title="Customer">
            {order.walkIn ? (
              <>
                <p className="font-medium">{order.walkIn.name}</p>
                {order.walkIn.companyName && <p className="text-sm">{order.walkIn.companyName}</p>}
                <p className="mt-1"><Badge tone="info">Walk-in — no customer account</Badge></p>
              </>
            ) : (
              <p className="font-medium">
                <Link href={`/admin/customers?q=${encodeURIComponent(order.customerName)}`} className="text-brand hover:underline">{order.customerName}</Link>
              </p>
            )}
            {order.customerEmail && <p className="text-sm break-all">{order.customerEmail}</p>}
            {order.customerPhone && <p className="text-sm text-muted">{order.customerPhone}</p>}
          </Card>

          <Card
            title={pickup ? "Fulfilment" : "Shipping address"}
            actions={!pickup && canEditItems(order.status) ? <OrderAddressEditButton orderId={order.id} which="shipping" current={order.shippingAddress} saved={savedAddresses} phoneOptional={Boolean(order.walkIn)} /> : undefined}
          >
            {order.shippingAddress ? <AddressBlock address={order.shippingAddress} /> : <p className="text-sm">Collected in store (no delivery address).</p>}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted">{order.shipping.label} · <span className="tabular-nums">{formatMoney(order.shipping.amount)}</span></p>
              {adjustable && <ShippingChargeButton orderId={order.id} label={order.shipping.label} amount={order.shipping.amount} />}
            </div>
            <div className="mt-2">
              <DeliveryDateEditor orderId={order.id} date={order.requestedDeliveryDate?.slice(0, 10)} editable={canChangeDeliveryDate(order.status)} />
            </div>
            {order.shipping.decision && (
              <p className="mt-2 text-xs text-muted">
                {order.shipping.decision.mode === "suggested"
                  ? `Suggested charge used (${order.shipping.decision.methodName ?? "rule"}, zone “${order.shipping.decision.zoneName ?? "—"}”).`
                  : `Agreed charge: “${order.shipping.decision.reason ?? ""}”.${order.shipping.decision.suggestedAmount !== undefined ? ` Suggested was ${formatMoney(order.shipping.decision.suggestedAmount)}${order.shipping.decision.zoneName ? ` (zone “${order.shipping.decision.zoneName}”)` : ""}.` : " No suggestion was available."}`}{" "}
                Saved amount {formatMoney(order.shipping.amount)} — not recalculated when shipping rules change.
              </p>
            )}
          </Card>

          {order.billingAddress && (
            <Card title="Billing address" actions={adjustable ? <OrderAddressEditButton orderId={order.id} which="billing" current={order.billingAddress} saved={savedAddresses} phoneOptional={Boolean(order.walkIn)} /> : undefined}>
              <AddressBlock address={order.billingAddress} />
            </Card>
          )}

          <Card title="Payment">
            <dl className="space-y-1.5 text-sm [&>div]:flex [&>div]:justify-between [&>div]:gap-4">
              <div><dt className="text-muted">Method</dt><dd>{paymentMethodLabels[order.payment.method]}</dd></div>
              <div><dt className="text-muted">Status</dt><dd><PaymentStatusBadge status={order.paymentStatus} /></dd></div>
              {order.payment.reference && <div><dt className="text-muted">Reference</dt><dd className="break-all">{order.payment.reference}</dd></div>}
              {order.payment.paidAt && <div><dt className="text-muted">Paid</dt><dd>{formatDateTime(order.payment.paidAt)}</dd></div>}
              {order.payment.amountPaid !== undefined && <div><dt className="text-muted">Already paid</dt><dd className="tabular-nums">{formatMoney(order.payment.amountPaid)}</dd></div>}
              {balance !== undefined && balance !== 0 && (
                <div>
                  <dt className="text-muted">{balance > 0 ? "Balance due" : "Overpaid"}</dt>
                  <dd className={balance < 0 ? "font-medium text-danger tabular-nums" : "font-medium tabular-nums"}>{formatMoney(Math.abs(balance))}</dd>
                </div>
              )}
            </dl>
            {balance !== undefined && balance !== 0 && (
              <p className="mt-2 text-xs text-muted">
                {balance > 0
                  ? `The order changed after payment. Collect ${formatMoney(balance)} (${paymentMethodLabels[order.payment.method]}).`
                  : `The order changed after payment. ${formatMoney(-balance)} was paid above the new total — use “Refund overpayment” to record returning it.`}
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              {order.status !== "cancelled" && (order.paymentStatus === "unpaid" || order.paymentStatus === "invoiced") && (
                <RecordPaymentButton orderId={order.id} amount={order.totals.netTotal} methodLabel={paymentMethodLabels[order.payment.method]} />
              )}
              {refunds.collected && refunds.refundable > 0 && <RefundButton orderId={order.id} summary={refunds} />}
              {refunds.collected && refunds.overpaid > 0 && <RefundButton orderId={order.id} summary={refunds} kind="overpayment" />}
            </div>
            {order.refunds.length > 0 && (
              <div className="mt-4 border-t border-line pt-3">
                <h3 className="text-sm font-medium">Refunds</h3>
                <ul className="mt-2 space-y-3 text-sm">
                  {[...order.refunds].reverse().map((r) => (
                    <li key={r.id}>
                      <div className="flex justify-between gap-4">
                        <span>{formatDateTime(r.at)}</span>
                        <span className="tabular-nums font-medium">−{formatMoney(r.amount)}</span>
                      </div>
                      <div className="mt-0.5 flex flex-wrap gap-1">
                        {!isOrderRefund(r) && <Badge tone="info">Overpayment</Badge>}
                        <Badge tone={r.status === "processed" ? "success" : "warning"}>{r.status === "processed" ? "Processed" : "Recorded only (demo)"}</Badge>
                      </div>
                      {(r.lines?.length || r.shipping) && (
                        <ul className="mt-1 text-xs tabular-nums">
                          {r.lines?.map((l) => (
                            <li key={l.orderItemId}>{l.name}{l.quantity > 0 && ` × ${l.quantity}`}: {formatMoney(l.amount)}</li>
                          ))}
                          {r.shipping ? <li>Delivery charge: {formatMoney(r.shipping)}</li> : null}
                        </ul>
                      )}
                      {r.restock?.map((s) => (
                        <p key={s.orderItemId} className="text-xs text-muted">
                          {s.result === "restocked" ? `Restocked ${s.quantity} × ${itemName.get(s.orderItemId) ?? "item"}` : `Not restocked (${itemName.get(s.orderItemId) ?? "item"}): ${s.note ?? "skipped"}`}
                        </p>
                      ))}
                      <p className="text-xs text-muted">{r.reason} · {r.by.name}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="mt-3 text-xs text-muted">
              Demo bookkeeping: recording a payment or refund only updates this order. Nothing here charges or returns money — the payment backend does that.
            </p>
          </Card>

          <Card title="Status history">
            <StatusHistoryList events={order.statusHistory} />
          </Card>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {order.status === "cancelled" && (
          <Notice tone="info">This order is cancelled, so it can no longer be edited. Notes can still be added.</Notice>
        )}
        <DemoEditingNotice />
      </div>
    </>
  );
}

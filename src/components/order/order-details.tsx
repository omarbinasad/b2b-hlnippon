import type { ReactNode } from "react";
import { Table } from "@/components/ui/table";
import { cx } from "@/lib/cx";
import { formatAddressLines, formatDateTime, formatMoney, formatWeight, humanize } from "@/lib/format";
import { paymentBalance } from "@/lib/orders/assemble";
import { fromMinor, toMinor } from "@/lib/orders/calc";
import { ORDER_FLOW, orderStatusLabels } from "@/lib/orders/status";
import { tierLabel } from "@/lib/pricing/engine";
import type { Address, Order, OrderItem, StatusEvent } from "@/lib/types";

/* Order display blocks shared by the admin order page and the customer portal. */

export const variationLabel = (attributes?: Record<string, string>) =>
  attributes ? Object.entries(attributes).map(([k, v]) => `${k}: ${v}`).join(", ") : "";

/** Items with their snapshot details. `renderAction` adds an admin-only last column; `renderDetails` adds admin info under each item. */
export function OrderItemsTable({
  items,
  renderAction,
  renderDetails,
  showPricing = false,
}: {
  items: OrderItem[];
  renderAction?: (item: OrderItem, index: number) => ReactNode;
  renderDetails?: (item: OrderItem) => ReactNode;
  /** Admin only: which price rule priced each line at order time. */
  showPricing?: boolean;
}) {
  return (
    <Table caption="Order items" density="compact">
      <thead>
        <tr>
          <th scope="col">Item</th>
          <th scope="col" className="text-right">Qty</th>
          <th scope="col" className="text-right">Unit price</th>
          <th scope="col">Weight</th>
          <th scope="col" className="text-right">Discount</th>
          <th scope="col" className="text-right">Line total</th>
          {renderAction && <th scope="col"><span className="sr-only">Actions</span></th>}
        </tr>
      </thead>
      <tbody>
        {items.map((item, i) => (
          <tr key={item.id}>
            <td className="min-w-48">
              <p className="font-medium">{item.name}</p>
              {item.attributes && <p className="text-xs">{variationLabel(item.attributes)}</p>}
              <p className="text-xs text-muted">
                {item.sku} · per {item.unitLabel} · {humanize(item.taxClass)} tax{item.pricedByWeight ? " · priced by weight" : ""}
              </p>
              {renderDetails?.(item)}
            </td>
            <td className="text-right tabular-nums">{item.quantity}</td>
            <td className="text-right whitespace-nowrap tabular-nums">
              {formatMoney(item.unitPrice)}
              {item.unitPrice !== item.catalogUnitPrice && (
                <span className="block text-xs text-muted">
                  catalog <s>{formatMoney(item.catalogUnitPrice)}</s>
                </span>
              )}
              {showPricing && item.pricing && (
                <span className="block max-w-48 text-xs whitespace-normal text-muted">
                  {item.pricing.ruleName && item.pricing.source === "sale"
                    ? `Sale price (lower than rule “${item.pricing.ruleName}”${item.pricing.rulePrice !== undefined ? ` at ${formatMoney(item.pricing.rulePrice)}` : ""})`
                    : item.pricing.ruleName
                    ? `Rule: ${item.pricing.ruleName}${item.pricing.tier ? ` (qty ${tierLabel(item.pricing.tier)})` : ""}`
                    : item.pricing.source === "sale"
                      ? "No rule — sale price"
                      : "No rule — regular price"}
                  {item.pricing.manualOverride && <> · agreed price (rule gave {formatMoney(item.pricing.ruleUnitPrice)})</>}
                </span>
              )}
            </td>
            <td className="whitespace-nowrap">
              {formatWeight(item.orderedWeight)}
              {item.fulfilledWeight && <span className="block text-xs text-muted">packed {formatWeight(item.fulfilledWeight)}</span>}
            </td>
            <td className="text-right tabular-nums">{item.discount ? `−${formatMoney(item.discount)}` : "—"}</td>
            <td className="text-right font-medium whitespace-nowrap tabular-nums">{formatMoney(item.lineTotal)}</td>
            {renderAction && <td className="text-right"><div className="flex flex-wrap justify-end gap-1">{renderAction(item, i)}</div></td>}
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

export function OrderTotalsList({ order, vatNote }: { order: Order; vatNote?: string }) {
  const t = order.totals;
  const row = "flex justify-between gap-4";
  const orderDiscount = t.orderDiscount ?? 0;
  const lineDiscounts = fromMinor(toMinor(t.discountTotal) - toMinor(orderDiscount));
  const balance = paymentBalance(order);
  return (
    <dl className="space-y-1.5 text-sm [&_dd]:tabular-nums">
      <div className={row}><dt>Items</dt><dd>{formatMoney(t.itemsSubtotal)}</dd></div>
      {lineDiscounts > 0 && <div className={row}><dt>{orderDiscount ? "Item discounts" : "Discounts"}</dt><dd>−{formatMoney(lineDiscounts)}</dd></div>}
      {orderDiscount > 0 && (
        <div className={row}>
          <dt>Order discount{order.discount?.type === "percent" ? ` (${order.discount.value}%)` : ""}</dt>
          <dd>−{formatMoney(orderDiscount)}</dd>
        </div>
      )}
      <div className={row}><dt>Shipping ({order.shipping.label})</dt><dd>{t.shippingTotal ? formatMoney(t.shippingTotal) : "Free"}</dd></div>
      {order.taxes.map((tax) => (
        <div key={tax.rateId ?? tax.taxClass} className={row}>
          <dt className="text-muted">
            {tax.rateName ?? `Consumption tax (${humanize(tax.taxClass)})`} {tax.rate}%{t.taxIncluded ? " included" : ""} on {formatMoney(tax.taxableAmount)}
          </dt>
          <dd>{formatMoney(tax.taxAmount)}</dd>
        </div>
      ))}
      <div className={cx(row, "border-t border-line pt-2 text-base font-semibold")}><dt>Total</dt><dd>{formatMoney(t.total)}</dd></div>
      {t.refundedTotal > 0 && (
        <>
          <div className={cx(row, "text-danger")}><dt>Refunded</dt><dd>−{formatMoney(t.refundedTotal)}</dd></div>
          <div className={cx(row, "font-semibold")}><dt>Net total</dt><dd>{formatMoney(t.netTotal)}</dd></div>
        </>
      )}
      {balance !== undefined && balance !== 0 && (
        <>
          <div className={row}><dt className="text-muted">Already paid</dt><dd>{formatMoney(order.payment.amountPaid!)}</dd></div>
          <div className={cx(row, "font-semibold", balance < 0 && "text-danger")}>
            <dt>{balance > 0 ? "Balance due" : "Overpaid (refund due)"}</dt>
            <dd>{formatMoney(Math.abs(balance))}</dd>
          </div>
        </>
      )}
      {vatNote && <p className="pt-1 text-xs text-muted">{vatNote}</p>}
    </dl>
  );
}

export function AddressBlock({ address }: { address: Address }) {
  return (
    <address className="text-sm not-italic">
      {address.companyName && <p className="font-medium">{address.companyName}</p>}
      <p>{address.recipientName}</p>
      {formatAddressLines(address).map((line) => <p key={line}>{line}</p>)}
      <p className="mt-1 text-muted">{address.phone}</p>
    </address>
  );
}

/** Received → Preparing → On the way → Delivered; cancelled shown separately. */
export function StatusProgress({ order }: { order: Order }) {
  const reached = (s: string) => order.statusHistory.find((e) => e.status === s);
  const currentIndex = ORDER_FLOW.indexOf(order.status as (typeof ORDER_FLOW)[number]);
  const cancelled = order.status === "cancelled" ? reached("cancelled") : undefined;
  return (
    <div>
      <ol className="grid grid-cols-4 gap-1" aria-label="Delivery progress">
        {ORDER_FLOW.map((s, i) => {
          const event = reached(s);
          const done = cancelled ? Boolean(event) : i <= currentIndex;
          const current = !cancelled && i === currentIndex;
          return (
            <li key={s} aria-current={current ? "step" : undefined} className="min-w-0">
              <div className={cx("h-1.5 rounded-full", done ? "bg-brand" : "bg-surface-muted")} />
              <p className={cx("mt-1.5 truncate text-xs font-medium sm:text-sm", done ? "text-foreground" : "text-muted")}>{orderStatusLabels[s]}</p>
              <p className="hidden text-xs text-muted sm:block">{event ? formatDateTime(event.at) : "—"}</p>
              <span className="sr-only">{done ? (current ? "current step" : "done") : "not yet"}</span>
            </li>
          );
        })}
      </ol>
      {cancelled && (
        <p role="note" className="mt-3 rounded-ui bg-danger-soft px-3 py-2 text-sm text-danger">
          Cancelled {formatDateTime(cancelled.at)}{cancelled.note ? ` — ${cancelled.note}` : ""}
        </p>
      )}
    </div>
  );
}

export function StatusHistoryList({ events }: { events: StatusEvent[] }) {
  return (
    <ol className="space-y-3 border-l border-line pl-4">
      {[...events].reverse().map((e) => (
        <li key={e.id} className="relative text-sm">
          <span aria-hidden className={cx("absolute top-1.5 -left-[1.3rem] size-2.5 rounded-full", e.status === "cancelled" ? "bg-danger" : "bg-brand")} />
          <p className="font-medium">{orderStatusLabels[e.status]}</p>
          <p className="text-xs text-muted">
            {formatDateTime(e.at)} · {e.by.name}
          </p>
          {e.note && <p className="mt-0.5 text-muted">{e.note}</p>}
        </li>
      ))}
    </ol>
  );
}

import type { Order, OrderStatus, PaymentMethod, PaymentStatus } from "@/lib/types";

/** Main delivery flow, in order. Cancelled is handled separately. */
export const ORDER_FLOW = ["received", "preparing", "on_the_way", "delivered"] as const satisfies readonly OrderStatus[];

export const orderStatusLabels: Record<OrderStatus, string> = {
  received: "Order received",
  preparing: "Preparing",
  on_the_way: "On the way",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export const paymentStatusLabels: Record<PaymentStatus, string> = {
  unpaid: "Unpaid",
  invoiced: "Invoiced",
  paid: "Paid",
  partially_refunded: "Partially refunded",
  refunded: "Refunded",
};

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  cash_on_delivery: "Cash on delivery",
  bank_transfer: "Bank transfer",
  mobile_wallet: "Mobile wallet",
  invoice: "Invoice (credit terms)",
};

/** Next step in the main flow, or undefined at the end / when cancelled. */
export function nextStatus(status: OrderStatus): OrderStatus | undefined {
  const i = ORDER_FLOW.indexOf(status as (typeof ORDER_FLOW)[number]);
  return i >= 0 && i < ORDER_FLOW.length - 1 ? ORDER_FLOW[i + 1] : undefined;
}

/** Forward one step along the flow, or cancel before delivery. Delivered and cancelled are final. */
export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  if (to === "cancelled") return from !== "delivered" && from !== "cancelled";
  return nextStatus(from) === to;
}

/** Items can be weighed/re-priced unless the order is cancelled (post-delivery corrections are allowed). */
export const canAdjust = (status: OrderStatus) => status !== "cancelled";

/** Items can be added, removed, replaced or have their quantity changed until the order is delivered or cancelled. */
export const canEditItems = (status: OrderStatus) => status === "received" || status === "preparing" || status === "on_the_way";

/** The delivery date can change until the order is delivered or cancelled. */
export const canChangeDeliveryDate = canEditItems;

/** The order discount follows the same rule as price adjustments (post-delivery corrections allowed). */
export const canChangeDiscount = canAdjust;

/**
 * Open orders: still being worked on (received, preparing, on the way). Delivered and cancelled orders are finished, and
 * a fully refunded order is closed. The Orders badge, the dashboard link and the "Open orders" filter all use this rule.
 */
export const isOpenOrder = (o: { status: OrderStatus; paymentStatus: PaymentStatus }) =>
  (o.status === "received" || o.status === "preparing" || o.status === "on_the_way") && o.paymentStatus !== "refunded";

/** Why an order can't be deleted, or undefined when it can. Anything with a money or document trail stays on record. */
export function orderDeleteError(order: Pick<Order, "status" | "paymentStatus" | "payment" | "refunds" | "invoices">) {
  if (order.status !== "cancelled") return "Only cancelled orders can be deleted. Cancel it first.";
  if (order.paymentStatus !== "unpaid" || order.payment.paidAt) return "This order has a payment recorded, so it stays on record.";
  if (order.refunds.length) return "This order has a refund recorded, so it stays on record.";
  if (order.invoices?.length) return "This order has an invoice, so it stays on record.";
  return undefined;
}

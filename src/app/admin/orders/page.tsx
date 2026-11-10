import { Can } from "@/components/admin/capabilities-context";
import type { Metadata } from "next";
import Link from "next/link";
import { ActionNotice, DemoEditingNotice } from "@/components/admin/demo-notice";
import { Badge, OrderStatusBadge, PaymentStatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Icon } from "@/components/ui/icons";
import { ListToolbar, SortHeader } from "@/components/ui/list-controls";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { Table } from "@/components/ui/table";
import { repositories } from "@/lib/data";
import type { OrderSortField } from "@/lib/data/repositories";
import { orderStatuses, orderStatusOptions, paymentStatuses, paymentStatusOptions } from "@/lib/enums";
import { formatDateTime, formatMoney, formatNumber } from "@/lib/format";
import { flatParams, listHref, listState, oneOf, param } from "@/lib/list-params";
import { nextStatus, orderStatusLabels } from "@/lib/orders/status";
import type { Order, OrderType } from "@/lib/types";
import { advanceOrderStatusAction } from "./actions";

export const metadata: Metadata = { title: "Orders" };

const PATH = "/admin/orders";
const SORTS = ["placed", "number", "customer", "total", "status"] as const satisfies readonly OrderSortField[];
const PER_PAGE = 20;

const itemCount = (o: Order) => o.items.reduce((s, i) => s + i.quantity, 0);

const ORDER_TYPES = ["first", "repeat", "walk_in"] as const satisfies readonly OrderType[];
const orderTypeBadge: Record<OrderType, { label: string; tone: "success" | "info" | "neutral" }> = {
  first: { label: "First", tone: "success" },
  repeat: { label: "Repeat", tone: "info" },
  walk_in: { label: "Walk-in", tone: "neutral" },
};

export default async function AdminOrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  const sp = await searchParams;
  const state = listState(sp, SORTS, "placed");
  const [routes, customers] = await Promise.all([
    repositories.delivery.listRoutes({ perPage: 48 }),
    repositories.customers.list({ sort: "company", perPage: 100 }),
  ]);
  const filters = {
    status: oneOf(param(sp, "status"), orderStatuses),
    excludeCancelled: param(sp, "status") === "active" || undefined,
    open: param(sp, "status") === "open" || undefined,
    paymentStatus: oneOf(param(sp, "payment"), paymentStatuses),
    customerId: oneOf(param(sp, "customer"), customers.items.map((c) => c.id)),
    deliveryRouteId: oneOf(param(sp, "route"), routes.items.map((r) => r.id)),
    orderType: oneOf(param(sp, "type"), ORDER_TYPES),
  };
  const [orders, cancelled] = await Promise.all([
    repositories.orders.list({ ...state, ...filters, perPage: PER_PAGE }),
    // For the note shown when one customer's orders are listed (their order count excludes cancelled orders).
    filters.customerId && !filters.status && !filters.excludeCancelled && !filters.open ? repositories.orders.list({ customerId: filters.customerId, status: "cancelled", perPage: 1 }) : undefined,
  ]);
  const forCustomer = filters.customerId ? customers.items.find((c) => c.id === filters.customerId) : undefined;
  const params = flatParams(sp);
  const { notice, ...listParams } = params;
  const returnTo = listHref(PATH, listParams, {});
  const sorting = { sort: state.sort, dir: state.dir, pathname: PATH, params: listParams };
  const filtered = Object.values(filters).some(Boolean) || state.search || param(sp, "from") || param(sp, "to");

  return (
    <>
      <PageHeader
        title="Orders"
        description="Search, review and progress customer orders."
        actions={
          <>
            <Can cap="orders.export"><ButtonLink href={listHref(`${PATH}/export`, listParams, {}) as typeof PATH} prefetch={false} variant="secondary">Export CSV</ButtonLink></Can>
            <Can cap="orders_create.create">
              <ButtonLink href="/admin/orders/new"><Icon name="plus" className="size-4" /> New order</ButtonLink>
            </Can>
          </>
        }
      />
      <ActionNotice notice={notice} />
      {forCustomer && (
        <p className="mb-4 rounded-ui border border-line bg-surface-muted px-4 py-3 text-sm">
          Orders of{" "}
          <Link href={`/admin/customers/${forCustomer.id}`} className="font-medium text-brand hover:underline">{forCustomer.companyName}</Link>
          : {formatNumber(forCustomer.orderCount)} active order{forCustomer.orderCount === 1 ? "" : "s"}
          {cancelled && cancelled.total > 0 && ` plus ${formatNumber(cancelled.total)} cancelled (listed here, not counted on the customer page)`}.
        </p>
      )}
      <ListToolbar
        pathname={PATH}
        params={listParams}
        searchLabel="Search orders"
        searchPlaceholder="Order no. or customer"
        filters={[
          { name: "status", label: "Fulfillment", options: [{ value: "open", label: "Open orders" }, { value: "active", label: "All except cancelled" }, ...orderStatusOptions], allLabel: "All statuses" },
          { name: "payment", label: "Payment", options: paymentStatusOptions, allLabel: "All payments" },
          { name: "type", label: "Order type", options: ORDER_TYPES.map((t) => ({ value: t, label: t === "walk_in" ? "Walk-in" : `${orderTypeBadge[t].label} order` })), allLabel: "All types" },
          { name: "customer", label: "Customer", options: customers.items.map((c) => ({ value: c.id, label: c.companyName })), allLabel: "All customers" },
          { name: "route", label: "Route", options: routes.items.map((r) => ({ value: r.id, label: r.name })), allLabel: "All routes" },
        ]}
        dates={{ fromLabel: "Placed from", toLabel: "Placed to" }}
        total={orders.total}
        page={orders.page}
        perPage={orders.perPage}
      />
      <div className="space-y-6">
        {orders.items.length ? (
          <Table caption="Orders">
            <thead>
              <tr>
                <SortHeader label="Order" field="number" defaultDir="desc" {...sorting} />
                <SortHeader label="Placed" field="placed" defaultDir="desc" {...sorting} />
                <SortHeader label="Customer" field="customer" {...sorting} />
                <th scope="col">Type</th>
                <th scope="col" className="text-right">Items</th>
                <SortHeader label="Total" field="total" defaultDir="desc" className="text-right" {...sorting} />
                <th scope="col">Payment</th>
                <SortHeader label="Fulfillment" field="status" {...sorting} />
                <th scope="col"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {orders.items.map((order) => {
                const next = nextStatus(order.status);
                return (
                  <tr key={order.id}>
                    <td className="font-medium whitespace-nowrap">
                      <Link href={`/admin/orders/${order.id}`} className="text-brand hover:underline">{order.number}</Link>
                      {order.createdVia === "admin" && <span className="block text-xs font-normal text-muted">by admin</span>}
                    </td>
                    <td className="whitespace-nowrap">{formatDateTime(order.placedAt)}</td>
                    <td className="min-w-40">
                      {order.customerName}
                      <span className="block text-xs text-muted">{order.shippingAddress?.city ?? "Store pickup"}</span>
                    </td>
                    <td><Badge tone={orderTypeBadge[order.orderType].tone}>{orderTypeBadge[order.orderType].label}</Badge></td>
                    <td className="text-right tabular-nums">
                      {formatNumber(itemCount(order))}
                      <span className="block text-xs text-muted">{order.items.length} line{order.items.length === 1 ? "" : "s"}</span>
                    </td>
                    <td className="text-right font-medium whitespace-nowrap tabular-nums">{formatMoney(order.totals.total)}</td>
                    <td><PaymentStatusBadge status={order.paymentStatus} /></td>
                    <td><OrderStatusBadge status={order.status} /></td>
                    <td>
                      <div className="flex items-center justify-end gap-2">
                        {next && (
                          <Can cap="order_status.edit"><form action={advanceOrderStatusAction}>
                            <input type="hidden" name="id" value={order.id} />
                            <input type="hidden" name="status" value={next} />
                            <input type="hidden" name="returnTo" value={returnTo} />
                            <button
                              type="submit"
                              className="rounded-ui border border-line px-2 py-1 text-xs font-medium whitespace-nowrap hover:bg-surface-muted"
                              aria-label={`Mark ${order.number} as ${orderStatusLabels[next]}`}
                            >
                              Mark {orderStatusLabels[next].toLowerCase()}
                            </button>
                          </form></Can>
                        )}
                        <Link
                          href={`/admin/orders/${order.id}`}
                          className="rounded-ui px-2 py-1 text-xs font-medium text-brand hover:bg-brand-soft"
                          aria-label={`View ${order.number}`}
                        >
                          View
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        ) : filtered ? (
          <EmptyState
            title="No orders match these filters"
            description="Try another search term, status, customer or date range."
            action={<ButtonLink href={PATH} variant="secondary">Clear filters</ButtonLink>}
          />
        ) : (
          <EmptyState
            title="No orders yet"
            description="Orders placed in the store, or created here for a customer, will appear in this list."
            action={<Can cap="orders_create.create"><ButtonLink href="/admin/orders/new">Create an order</ButtonLink></Can>}
          />
        )}
        <Pagination page={orders.page} totalPages={orders.totalPages} pathname={PATH} searchParams={listParams} />
        <DemoEditingNotice />
      </div>
    </>
  );
}

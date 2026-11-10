import Link from "next/link";
import { OrderTable } from "@/components/order/order-table";
import { ButtonLink } from "@/components/ui/button";
import { Card, StatCard } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { getPortalCustomerId } from "@/lib/auth/session";
import { repositories } from "@/lib/data";
import { formatCalendarDate, formatMoney, formatNumber } from "@/lib/format";
import { orderStatusLabels } from "@/lib/orders/status";

export default async function AccountDashboardPage() {
  const customerId = await getPortalCustomerId();
  const [customer, orders, summary, locations, notifications, lists, quotations] = await Promise.all([
    repositories.customers.getById(customerId),
    repositories.orders.list({ customerId, perPage: 5 }),
    repositories.orders.accountSummary(customerId),
    repositories.delivery.forCustomer(customerId),
    repositories.customers.listNotifications(customerId, { unreadOnly: true, perPage: 1 }),
    repositories.savedLists.list(customerId),
    repositories.quotations.list({ customerId, status: "quoted", perPage: 1 }),
  ]);
  const next = locations.flatMap((l) => l.upcoming.slice(0, 1).map((u) => ({ ...u, label: l.address.label, route: l.route?.name }))).sort((a, b) => a.date.localeCompare(b.date));

  return (
    <>
      <PageHeader
        title={`Welcome, ${customer?.contactName ?? "customer"}`}
        description={customer?.companyName ?? "Your orders, deliveries and account at a glance."}
        actions={<ButtonLink href="/account/quick-order">Quick order</ButtonLink>}
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Open orders" value={formatNumber(summary.openOrders)} />
        <StatCard label="Total orders" value={formatNumber(summary.totalOrders)} />
        <StatCard label="Spent this month" value={formatMoney(summary.monthSpend)} hint={`Last month ${formatMoney(summary.lastMonthSpend)}`} />
        <StatCard label="Unread notifications" value={formatNumber(notifications.total)} />
      </div>
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card title="Upcoming deliveries">
          {next.length ? (
            <ul className="space-y-2 text-sm">
              {next.map((n) => <li key={n.label}><strong>{formatCalendarDate(n.date)}</strong><span className="block text-xs text-muted">{n.label} · order by {formatCalendarDate(n.orderByDate)}, {n.orderByTime}</span></li>)}
            </ul>
          ) : <p className="text-sm text-muted">No delivery dates right now.</p>}
          <Link href="/account/deliveries" className="mt-3 inline-block text-sm font-medium text-brand hover:underline">All deliveries</Link>
        </Card>
        <Card title="Orders by status">
          <ul className="space-y-1 text-sm">
            {summary.byStatus.map((s) => <li key={s.status} className="flex justify-between gap-2"><span>{orderStatusLabels[s.status]}</span><span className="tabular-nums">{formatNumber(s.count)}</span></li>)}
          </ul>
        </Card>
        <Card title="Quick actions">
          <ul className="space-y-1.5 text-sm">
            <li><Link href="/account/quick-order" className="font-medium text-brand hover:underline">Place a quick order</Link></li>
            <li><Link href="/account/lists" className="font-medium text-brand hover:underline">Saved lists ({lists.length})</Link></li>
            <li><Link href="/account/quotations" className="font-medium text-brand hover:underline">Quotations{quotations.total ? ` (${quotations.total} ready)` : ""}</Link></li>
            <li><Link href="/account/invoices" className="font-medium text-brand hover:underline">Invoices</Link></li>
          </ul>
        </Card>
      </div>
      <h2 className="mt-8 mb-3 text-lg font-semibold">Recent orders</h2>
      {orders.items.length ? <OrderTable orders={orders.items} linkToDetail /> : <EmptyState title="No orders yet" description="Your orders will appear here." />}
    </>
  );
}

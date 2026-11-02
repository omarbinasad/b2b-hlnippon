import { OrderTable } from "@/components/order/order-table";
import { ButtonLink } from "@/components/ui/button";
import { StatCard } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { getPortalCustomerId } from "@/lib/auth/session";
import { repositories } from "@/lib/data";

export default async function AccountDashboardPage() {
  const customerId = await getPortalCustomerId();
  const [customer, orders, notifications] = await Promise.all([
    repositories.customers.getById(customerId),
    repositories.orders.list({ customerId, perPage: 5 }),
    repositories.customers.listNotifications(customerId, { unreadOnly: true, perPage: 1 }),
  ]);
  const openOrders = orders.items.filter((o) => !["delivered", "cancelled"].includes(o.status)).length;
  const unread = notifications.total;

  return (
    <>
      <PageHeader
        title={`Welcome, ${customer?.contactName ?? "customer"}`}
        description="Your orders, deliveries and account at a glance."
        actions={<ButtonLink href="/account/quick-order">Quick order</ButtonLink>}
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label="Open orders" value={openOrders} />
        <StatCard label="Total orders" value={orders.total} />
        <StatCard label="Unread notifications" value={unread} />
      </div>
      <h2 className="mt-8 mb-3 text-lg font-semibold">Recent orders</h2>
      {orders.items.length ? (
        <OrderTable orders={orders.items} linkToDetail />
      ) : (
        <EmptyState title="No orders yet" description="Your orders will appear here." />
      )}
    </>
  );
}

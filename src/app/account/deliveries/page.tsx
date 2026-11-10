import type { Metadata } from "next";
import Link from "next/link";
import { OrderStatusBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { getPortalCustomerId } from "@/lib/auth/session";
import { repositories } from "@/lib/data";
import { formatAddressLines, formatCalendarDate, formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Deliveries" };

const DAY: Record<string, string> = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun" };

export default async function DeliveriesPage() {
  const customerId = await getPortalCustomerId();
  const [locations, open] = await Promise.all([repositories.delivery.forCustomer(customerId), repositories.orders.list({ customerId, open: true, perPage: 20 })]);
  return (
    <>
      <PageHeader title="Deliveries" description="When we deliver to your addresses, and your orders on the way." />
      <div className="space-y-6">
        {locations.length ? (
          <ul className="grid gap-4 md:grid-cols-2">
            {locations.map(({ address, route, upcoming }) => (
              <li key={address.id}>
                <Card title={address.label} description={formatAddressLines(address).join(", ")}>
                  {route ? (
                    <>
                      <p className="text-sm"><span className="font-medium">{route.name}</span>: {route.deliveryDays.map((d) => DAY[d] ?? d).join(", ")}</p>
                      {upcoming.length ? (
                        <>
                          <p className="mt-3 text-sm">Next delivery: <strong>{formatCalendarDate(upcoming[0].date)}</strong></p>
                          <p className="text-xs text-muted">Order by {formatCalendarDate(upcoming[0].orderByDate)}, {upcoming[0].orderByTime}</p>
                          <h3 className="mt-3 text-xs font-semibold tracking-wide text-muted uppercase">Then</h3>
                          <ul className="mt-1 space-y-0.5 text-sm">{upcoming.slice(1).map((u) => <li key={u.date}>{formatCalendarDate(u.date)}</li>)}</ul>
                        </>
                      ) : <p className="mt-3 text-sm text-muted">No delivery dates are scheduled right now.</p>}
                    </>
                  ) : <p className="text-sm text-muted">No delivery route covers this address yet. Please contact us.</p>}
                </Card>
              </li>
            ))}
          </ul>
        ) : <EmptyState title="No delivery addresses" description="Add a delivery address to see delivery dates." />}
        <Card title="Orders in progress">
          {open.items.length ? (
            <ul className="divide-y divide-line">
              {open.items.map((o) => (
                <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                  <Link href={`/account/orders/${o.id}`} className="font-medium text-brand hover:underline">{o.number}</Link>
                  <span className="text-muted">{o.requestedDeliveryDate ? formatDate(o.requestedDeliveryDate) : "Delivery date to be confirmed"}</span>
                  <OrderStatusBadge status={o.status} />
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted">Nothing in progress.</p>}
        </Card>
      </div>
    </>
  );
}

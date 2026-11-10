import { AllowedLink } from "@/components/admin/capabilities-context";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DemoEditingNotice } from "@/components/admin/demo-notice";
import { RouteForm } from "@/components/admin/notify/forms";
import { OrderStatusBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { repositories } from "@/lib/data";
import { formatCalendarDate, formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Delivery schedule" };

export default async function SchedulePage({ params }: PageProps<"/admin/delivery/[id]">) {
  const { id } = await params;
  const [route, detail] = await Promise.all([repositories.delivery.getRoute(id), repositories.delivery.routeDetail(id)]);
  if (!route || !detail) notFound();
  return (
    <>
      <Link href="/admin/delivery" className="text-sm text-muted hover:text-foreground">← All schedules</Link>
      <PageHeader title={route.name} />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <RouteForm route={route} />
        <aside className="min-w-0 space-y-4">
          <Card title="Upcoming deliveries">
            {detail.upcoming.length ? (
              <ul className="space-y-1.5 text-sm">{detail.upcoming.map((u) => <li key={u.date}><strong>{formatCalendarDate(u.date)}</strong><span className="block text-xs text-muted">Order by {formatCalendarDate(u.orderByDate)}, {u.orderByTime}</span></li>)}</ul>
            ) : <p className="text-sm text-muted">No dates. The schedule may be inactive.</p>}
          </Card>
          <Card title={`Eligible customers (${detail.customers.length})`} description="Approved customers with a delivery address in these areas.">
            {detail.customers.length ? <ul className="scrollbar-thin max-h-56 space-y-1 overflow-y-auto text-sm">{detail.customers.map((c) => <li key={c.id}><Link href={`/admin/customers/${c.id}`} className="text-brand hover:underline">{c.name}</Link></li>)}</ul> : <p className="text-sm text-muted">None yet.</p>}
          </Card>
          <Card title={`Open orders (${detail.orders.length})`}>
            {detail.orders.length ? (
              <ul className="scrollbar-thin max-h-72 space-y-2 overflow-y-auto text-sm">
                {detail.orders.map((o) => (
                  <li key={o.id} className="flex flex-wrap items-center justify-between gap-1">
                    <span><AllowedLink href={`/admin/orders/${o.id}`} className="font-medium text-brand hover:underline">{o.number}</AllowedLink><span className="block text-xs text-muted">{o.customerName}{o.requestedDeliveryDate ? ` · ${formatDate(o.requestedDeliveryDate)}` : ""}</span></span>
                    <OrderStatusBadge status={o.status} />
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted">None.</p>}
          </Card>
          <DemoEditingNotice />
        </aside>
      </div>
    </>
  );
}

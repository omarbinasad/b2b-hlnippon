import type { Route } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { OrderStatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/feedback";
import { Icon, type IconName } from "@/components/ui/icons";
import { Table } from "@/components/ui/table";
import { cx } from "@/lib/cx";
import { formatMoney, formatNumber, percentChange } from "@/lib/format";
import type { Kpi, LowStockItem, RankingItem, RecentOrderSummary } from "@/lib/types";

export function Panel({ title, action, className, children }: { title: string; action?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <section className={cx("min-w-0 rounded-ui border border-line bg-surface p-4 sm:p-5", className)}>
      <header className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold sm:text-lg">{title}</h2>
        {action}
      </header>
      {children}
    </section>
  );
}

export function PanelLink({ href, children }: { href: Route; children: ReactNode }) {
  return (
    <Link href={href} className="text-sm font-medium text-brand hover:underline">
      {children}
    </Link>
  );
}

/** "↑ +18%" in success/danger colors; nothing when there is no comparison baseline. */
export function Delta({ current, previous, className }: { current: number; previous?: number; className?: string }) {
  const change = percentChange(current, previous);
  if (change === undefined) return previous === undefined ? null : <span className={cx("text-xs text-muted", className)}>—</span>;
  const up = change >= 0;
  return (
    <span className={cx("inline-flex items-center gap-0.5 text-xs font-semibold tabular-nums", up ? "text-success" : "text-danger", className)}>
      <Icon name={up ? "arrowUp" : "arrowDown"} className="size-3.5" />
      <span className="sr-only">{up ? "Up" : "Down"}</span>
      {up ? "+" : "−"}
      {Math.abs(change).toFixed(change !== 0 && Math.abs(change) < 10 ? 1 : 0)}%
    </span>
  );
}

/** KPI box. With `href` the whole box links to the matching list (e.g. orders filtered by type and dates). */
export function KpiCard({ icon, label, kpi, format, href, hint }: { icon: IconName; label: string; kpi: Kpi; format: (n: number) => string; href?: string; hint?: string }) {
  const body = (
    <>
      <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-soft text-brand sm:size-12">
        <Icon name={icon} className="size-5 sm:size-6" />
      </span>
      <div className="min-w-0">
        <p className="text-sm text-muted">{label}</p>
        <p className="mt-1 text-xl font-semibold tracking-tight tabular-nums sm:text-2xl xl:text-[1.75rem]">{format(kpi.current)}</p>
        <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <Delta current={kpi.current} previous={kpi.previous} />
          <span className="text-xs text-muted">
            {kpi.previous === undefined ? "No comparison" : `vs ${format(kpi.previous)}`}
          </span>
        </p>
        {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
        {href && <p className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand">View orders <Icon name="arrowRight" className="size-3.5" /></p>}
      </div>
    </>
  );
  const box = "flex flex-col gap-3 rounded-ui border border-line bg-surface p-4 sm:flex-row sm:items-start sm:gap-4 sm:p-5";
  return href ? (
    <Link href={href as Route} className={cx(box, "transition hover:border-brand hover:shadow-md")}>{body}</Link>
  ) : (
    <div className={box}>{body}</div>
  );
}

export function RecentOrders({ orders }: { orders: RecentOrderSummary[] }) {
  if (orders.length === 0) return <EmptyState title="No orders in this period" />;
  return (
    <>
      {/* Phone: stacked list */}
      <ul className="divide-y divide-line sm:hidden">
        {orders.map((o) => (
          <li key={o.id} className="flex items-start justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold">{o.number}</p>
              <p className="truncate text-sm">{o.customerName}</p>
              <p className="text-xs text-muted">{o.location}</p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span className="text-sm font-semibold tabular-nums">{formatMoney(o.total)}</span>
              <OrderStatusBadge status={o.status} />
            </div>
          </li>
        ))}
      </ul>
      {/* Larger screens: table */}
      <div className="hidden sm:block">
        <Table caption="Recent orders" density="compact">
          <thead>
            <tr>
              <th scope="col">Order no.</th>
              <th scope="col">Customer</th>
              <th scope="col" className="text-right">Amount</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td className="font-semibold whitespace-nowrap">{o.number}</td>
                <td className="max-w-52">
                  <span className="block truncate">{o.customerName}</span>
                  <span className="block text-xs text-muted">{o.location}</span>
                </td>
                <td className="text-right whitespace-nowrap tabular-nums">{formatMoney(o.total)}</td>
                <td><OrderStatusBadge status={o.status} /></td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    </>
  );
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter((w) => /^[A-Za-z]/.test(w))
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");

export function RankingList({ items, compareLabel }: { items: RankingItem[]; compareLabel?: string }) {
  if (items.length === 0) return <EmptyState title="No sales in this period" />;
  return (
    <ol className="divide-y divide-line">
      {items.map((item, index) => (
        <li key={item.id} className="flex items-center gap-3 py-3">
          <span className="w-4 shrink-0 text-sm text-muted tabular-nums">{index + 1}</span>
          <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-ui bg-brand-soft text-xs font-semibold text-brand">
            {initials(item.name)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{item.name}</p>
            {item.detail && <p className="text-xs text-muted">{item.detail}</p>}
          </div>
          <div className="shrink-0 text-right">
            <p className="text-sm font-semibold tabular-nums">{formatMoney(item.revenue)}</p>
            {item.previousRevenue !== undefined && (
              <p title={compareLabel ? `vs ${compareLabel}` : undefined}>
                <Delta current={item.revenue} previous={item.previousRevenue} />
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

export function LowStockList({ items }: { items: LowStockItem[] }) {
  if (items.length === 0) return <p className="text-sm text-muted">All products are above the alert level.</p>;
  return (
    <ul className="divide-y divide-line">
      {items.map((item) => (
        <li key={item.productId} className="flex items-center justify-between gap-3 py-2.5">
          <span className="flex min-w-0 items-center gap-2 text-sm">
            <Icon name="alert" className="size-4 shrink-0 text-warning" />
            <span className="truncate">{item.name}</span>
          </span>
          <span className="shrink-0 text-sm font-medium text-danger tabular-nums">
            {item.quantity === 0 ? "Out of stock" : `${formatNumber(item.quantity)} ${item.unitLabel}s left`}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function PendingApprovals({ count }: { count: number }) {
  return (
    <Link
      href="/admin/customers"
      className="group flex items-center gap-4 rounded-ui border border-line bg-surface p-4 hover:border-brand sm:p-5"
    >
      <span aria-hidden className="grid size-12 shrink-0 place-items-center rounded-full bg-danger-soft text-danger">
        <Icon name="fileUser" className="size-6" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-semibold">Pending approvals</span>
        <span className="block text-2xl font-semibold tabular-nums">{formatNumber(count)}</span>
        <span className="block text-sm text-muted">New customer registrations</span>
      </span>
      <Icon name="chevronRight" className="size-5 text-muted group-hover:text-foreground" />
    </Link>
  );
}

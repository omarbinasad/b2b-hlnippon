import { Can } from "@/components/admin/capabilities-context";
import type { Metadata } from "next";
import Link from "next/link";
import { RevenueChart } from "@/components/admin/dashboard/charts";
import { StatusDonut } from "@/components/admin/dashboard/charts";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, StatCard } from "@/components/ui/card";
import { EmptyState, Notice } from "@/components/ui/feedback";
import { DateRangeFields } from "@/components/ui/date-picker";
import { PageHeader } from "@/components/ui/page-header";
import { Table } from "@/components/ui/table";
import { siteConfig } from "@/config/site";
import { repositories } from "@/lib/data";
import { addDays, previousPeriod, todayIn, validRange } from "@/lib/date-range";
import { formatDateRange, formatMoney, formatNumber, percentChange } from "@/lib/format";
import { flatParams, oneOf, param } from "@/lib/list-params";
import { cx } from "@/lib/cx";
import type { ReportRow } from "@/lib/reports/aggregate";
import type { OrderStatus } from "@/lib/types";

export const metadata: Metadata = { title: "Reports" };

const PATH = "/admin/reports";
const TABS = [["sales", "Sales"], ["orders", "Orders"], ["customers", "Customers"], ["products", "Products"], ["comparison", "Revenue comparison"], ["exports", "Exports"]] as const;

function RowsTable({ caption, first, rows, showUnits, showOrders = true }: { caption: string; first: string; rows: ReportRow[]; showUnits?: boolean; showOrders?: boolean }) {
  if (!rows.length) return <EmptyState title="Nothing in this period" />;
  return (
    <Table caption={caption} density="compact">
      <thead><tr><th scope="col">{first}</th>{showOrders && <th scope="col" className="text-right">Orders</th>}{showUnits && <th scope="col" className="text-right">Units</th>}<th scope="col" className="text-right">Net sales</th></tr></thead>
      <tbody>{rows.map((r) => <tr key={r.label}><td className="min-w-40">{r.label}</td>{showOrders && <td className="text-right tabular-nums">{formatNumber(r.orders ?? 0)}</td>}{showUnits && <td className="text-right tabular-nums">{formatNumber(r.units ?? 0)}</td>}<td className="text-right whitespace-nowrap tabular-nums">{formatMoney(r.sales)}</td></tr>)}</tbody>
    </Table>
  );
}

const EXPORTS = [["summary", "Summary"], ["monthly", "Monthly sales"], ["products", "Top products"], ["categories", "Categories"], ["customers", "Top customers"], ["groups", "Customer groups"], ["locations", "Sales by location"], ["statuses", "Order status"]] as const;

export default async function ReportsPage({ searchParams }: PageProps<"/admin/reports">) {
  const sp = await searchParams;
  const today = todayIn(siteConfig.timeZone);
  const tab = oneOf(param(sp, "tab"), TABS.map((t) => t[0])) ?? "sales";
  const range = validRange(param(sp, "from"), param(sp, "to"), today) ?? { from: addDays(today, -29), to: today };
  const compare = previousPeriod(range);
  const [data, prev, dash] = await Promise.all([
    repositories.analytics.report(range),
    repositories.analytics.report(compare),
    repositories.analytics.getDashboard({ range, compare }),
  ]);
  const s = data.summary;
  const params = flatParams(sp);
  const href = (t: string) => `${PATH}?${new URLSearchParams({ ...params, tab: t }).toString()}` as "/admin/reports";
  const exportHref = (kind: string) => `/admin/reports/export?${new URLSearchParams({ kind, from: range.from, to: range.to }).toString()}`;
  const change = (now: number, before: number) => {
    const p = percentChange(now, before);
    return p === undefined ? "No earlier figure" : `${p >= 0 ? "+" : ""}${p.toFixed(1)}% vs previous period`;
  };
  return (
    <>
      <PageHeader title="Reports" description={`${formatDateRange(range)}. Sample figures from demo data, not real sales.`} />
      <form action={PATH} className="mb-4 flex flex-wrap items-end gap-3 rounded-ui border border-line bg-surface p-3 sm:p-4">
        <input type="hidden" name="tab" value={tab} />
        <DateRangeFields idPrefix="report" fromLabel="From" toLabel="To" defaultFrom={range.from} defaultTo={range.to} max={today} />
        <Button type="submit">Apply</Button>
      </form>
      <nav aria-label="Reports" className="scrollbar-none mb-6 flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map(([key, label]) => <Link key={key} href={href(key)} aria-current={tab === key ? "page" : undefined} className={cx("-mb-px shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap", tab === key ? "border-brand text-brand" : "border-transparent text-muted hover:text-foreground")}>{label}</Link>)}
      </nav>

      {tab === "sales" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Total sales" value={formatMoney(s.totalSales)} hint="With tax and shipping" />
            <StatCard label="Net sales" value={formatMoney(s.netSales)} hint="Items after discounts" />
            <StatCard label="Average order" value={formatMoney(s.averageOrderValue)} />
            <StatCard label="Orders" value={formatNumber(s.orders)} />
            <StatCard label="Discounts" value={formatMoney(s.discounts)} hint={`Coupons ${formatMoney(s.couponDiscounts)}`} />
            <StatCard label="Refunds" value={formatMoney(s.refunds)} />
            <StatCard label="Shipping" value={formatMoney(s.shipping)} />
            <StatCard label="Tax" value={formatMoney(s.tax)} />
          </div>
          <Card title="Monthly sales"><RowsTable caption="Monthly sales" first="Month" rows={data.monthly} /></Card>
          <Card title="Sales by location"><RowsTable caption="Sales by location" first="Location" rows={data.locations} /></Card>
        </div>
      )}
      {tab === "orders" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card title="Order status"><StatusDonut data={data.statuses.map((x) => ({ status: x.status as OrderStatus, count: x.count }))} /></Card>
          <div className="grid grid-cols-2 content-start gap-3">
            <StatCard label="Orders" value={formatNumber(s.orders)} hint="Without cancelled" />
            <StatCard label="Repeat orders" value={formatNumber(s.repeatOrders)} />
            <StatCard label="Average order" value={formatMoney(s.averageOrderValue)} />
            <StatCard label="Discounts" value={formatMoney(s.discounts)} />
          </div>
        </div>
      )}
      {tab === "customers" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Customers who ordered" value={formatNumber(s.customers)} />
            <StatCard label="New customers" value={formatNumber(s.newCustomers)} />
            <StatCard label="Returning customers" value={formatNumber(s.returningCustomers)} />
            <StatCard label="Repeat orders" value={formatNumber(s.repeatOrders)} />
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card title="Top customers"><RowsTable caption="Top customers" first="Customer" rows={data.topCustomers} /></Card>
            <Card title="Customer groups"><RowsTable caption="Customer groups" first="Group" rows={data.groups} /></Card>
          </div>
        </div>
      )}
      {tab === "products" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card title="Top-selling products"><RowsTable caption="Top-selling products" first="Product" rows={data.topProducts} showUnits /></Card>
          <Card title="Product categories"><RowsTable caption="Product categories" first="Category" rows={data.categories} showUnits /></Card>
        </div>
      )}
      {tab === "comparison" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Net sales" value={formatMoney(s.netSales)} hint={change(s.netSales, prev.summary.netSales)} />
            <StatCard label="Orders" value={formatNumber(s.orders)} hint={change(s.orders, prev.summary.orders)} />
            <StatCard label="Average order" value={formatMoney(s.averageOrderValue)} hint={change(s.averageOrderValue, prev.summary.averageOrderValue)} />
            <StatCard label="Customers" value={formatNumber(s.customers)} hint={change(s.customers, prev.summary.customers)} />
          </div>
          <Card title="Revenue trend" description={`${formatDateRange(range)} against ${formatDateRange(compare)}`}>
            <RevenueChart current={dash.revenueSeries.current} previous={dash.revenueSeries.previous} currentLabel={formatDateRange(range)} previousLabel={formatDateRange(compare)} granularity={dash.granularity} />
          </Card>
        </div>
      )}
      {tab === "exports" && (
        <div className="space-y-4">
          <Notice>CSV files of the sample figures for this period, created on the demo server. The backend will generate real exports.</Notice>
          <Can cap="reports.export" fallback={<p className="text-sm text-muted">Your role can see reports but can&apos;t download them. That needs the &quot;Export reports&quot; permission.</p>}><ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {EXPORTS.map(([kind, label]) => <li key={kind}><ButtonLink href={exportHref(kind) as "/admin/reports"} prefetch={false} variant="secondary" className="w-full">{label}</ButtonLink></li>)}
          </ul></Can>
        </div>
      )}
    </>
  );
}

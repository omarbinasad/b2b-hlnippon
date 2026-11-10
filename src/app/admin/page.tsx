import { Can } from "@/components/admin/capabilities-context";
import type { Metadata } from "next";
import { RoleDashboard } from "@/components/admin/staff/role-dashboard";
import { getAdminRole } from "@/lib/auth/session";
import { RevenueChart, StatusDonut } from "@/components/admin/dashboard/charts";
import { DashboardFilters } from "@/components/admin/dashboard/filters";
import {
  KpiCard,
  LowStockList,
  Panel,
  PanelLink,
  PendingApprovals,
  RankingList,
  RecentOrders,
} from "@/components/admin/dashboard/panels";
import { Icon } from "@/components/ui/icons";
import { Tabs } from "@/components/ui/tabs";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { siteConfig } from "@/config/site";
import { repositories } from "@/lib/data";
import { parseDashboardParams, todayIn } from "@/lib/date-range";
import { formatDateRange, formatMoney, formatNumber } from "@/lib/format";

export const metadata: Metadata = { title: "Dashboard" };

export default async function AdminDashboardPage({ searchParams }: PageProps<"/admin">) {
  const [notifications, role] = await Promise.all([repositories.adminNotifications.feed({ limit: 0 }), getAdminRole()]);
  // Roles without reports get a dashboard of what they can do.
  if (role && !role.capabilities.includes("reports.view")) return <RoleDashboard role={role} openOrders={notifications.openOrders} pendingRequests={notifications.pendingRegistrations} />;
  const today = todayIn(siteConfig.timeZone);
  const params = parseDashboardParams(await searchParams, today);
  const data = await repositories.analytics.getDashboard({ range: params.range, compare: params.compare });

  const rangeLabel = formatDateRange(data.range);
  const compareLabel = formatDateRange(data.compare);
  const compareText = data.compare ? compareLabel : undefined;
  /** Orders in the selected dates, without cancelled ones (same basis as the boxes), optionally of one type. */
  const ordersHref = (type?: "first" | "repeat") =>
    `/admin/orders?${new URLSearchParams({ ...(type ? { type } : {}), status: "active", from: data.range.from, to: data.range.to })}`;

  return (
    <>
      <header className="mb-6 flex flex-col gap-4 2xl:flex-row 2xl:items-start 2xl:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Dashboard</h1>
          <p className="mt-1 text-sm text-muted sm:text-base">Overview of your wholesale business performance</p>
        </div>
        <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-start">
          <DashboardFilters
            today={today}
            range={params.range}
            preset={params.preset}
            compareMode={params.compareMode}
            compare={params.compare}
            rangeLabel={rangeLabel}
            compareLabel={compareLabel}
          />
          <div className="flex items-center gap-2">
            <ThemeToggle variant="switch" />
            <p
              className="inline-flex h-11 items-center gap-2 rounded-ui bg-brand-soft px-4 text-sm font-medium text-brand"
              title="Sample figures generated from mock data, not real sales"
            >
              <Icon name="chart" className="size-4" />
              Preview data
              <span className="sr-only">: sample figures generated from mock data, not real sales</span>
            </p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3">
        <KpiCard icon="chart" label="Revenue" kpi={data.kpis.revenue} format={formatMoney} />
        <KpiCard icon="cart" label="Orders" kpi={data.kpis.orders} format={formatNumber} href={ordersHref()} />
        <KpiCard icon="users" label="Active customers" kpi={data.kpis.activeCustomers} format={formatNumber} />
        <KpiCard icon="coins" label="Average order" kpi={data.kpis.averageOrderValue} format={formatMoney} />
        <KpiCard icon="user" label="New orders" kpi={data.kpis.newOrders} format={formatNumber} hint="Customers' first orders" href={ordersHref("first")} />
        <KpiCard icon="repeat" label="Repeat orders" kpi={data.kpis.repeatOrders} format={formatNumber} hint="From returning customers" href={ordersHref("repeat")} />
      </div>
      <p className="mt-2 text-xs text-muted">
        Revenue is net sales (items and adjustments, excluding tax, shipping and cancelled orders). Order figures exclude cancelled orders; click a box to see its orders.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Panel
          title="Revenue trend"
          className="xl:col-span-2"
          action={
            <ul className="flex flex-wrap justify-end gap-x-4 gap-y-1 text-xs text-muted">
              <li className="inline-flex items-center gap-1.5">
                <span aria-hidden className="size-2.5 rounded-full" style={{ background: "var(--chart-current)" }} />
                {rangeLabel}
              </li>
              {compareText && (
                <li className="inline-flex items-center gap-1.5">
                  <span aria-hidden className="h-0.5 w-4 border-t-2 border-dashed" style={{ borderColor: "var(--chart-previous)" }} />
                  {compareText}
                </li>
              )}
            </ul>
          }
        >
          <RevenueChart
            current={data.revenueSeries.current}
            previous={data.revenueSeries.previous}
            currentLabel={rangeLabel}
            previousLabel={compareText}
            granularity={data.granularity}
          />
        </Panel>
        <Panel title="Order status">
          <StatusDonut data={data.orderStatus} />
        </Panel>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2 2xl:grid-cols-12">
        <Can cap="orders.view"><Panel title="Recent orders" action={<span className="flex gap-3"><PanelLink href="/admin/orders?status=open">Open orders ({notifications.openOrders})</PanelLink><PanelLink href="/admin/orders">All orders</PanelLink></span>} className="2xl:col-span-5">
          <RecentOrders orders={data.recentOrders} />
        </Panel></Can>

        <Panel title="Top sellers" className="2xl:col-span-4">
          <Tabs
            label="Top sellers"
            tabs={[
              { id: "products", label: "Top products", content: <RankingList items={data.topProducts} compareLabel={compareText} /> },
              { id: "categories", label: "Top categories", content: <RankingList items={data.topCategories} compareLabel={compareText} /> },
              { id: "customers", label: "Top customers", content: <RankingList items={data.topCustomers} compareLabel={compareText} /> },
            ]}
          />
        </Panel>

        <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 sm:items-start xl:col-span-2 2xl:col-span-3 2xl:grid-cols-1 2xl:content-start">
          <Can cap="products.view"><Panel title="Low stock alerts" action={<PanelLink href="/admin/products">View all</PanelLink>}>
            <LowStockList items={data.lowStock} />
          </Panel></Can>
          <Can cap="customer_approval.view"><PendingApprovals count={data.pendingApprovals} /></Can>
        </div>
      </div>
    </>
  );
}

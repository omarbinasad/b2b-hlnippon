import "server-only";

import { addDays, rangeLength } from "@/lib/date-range";
import { sumMoney } from "@/lib/orders/calc";
import { orderTypeResolver } from "@/lib/orders/order-type";
import { lineNetSales, orderNetSales } from "@/lib/orders/net-sales";
import type { DashboardQuery, DashboardSummary, DateRange, Order, OrderStatus, RankingItem, SeriesPoint } from "@/lib/types";
import { mockCategories, mockProducts } from "./mock/catalog";
import { mockCustomers } from "./mock/customers";
import { mockOrders } from "./mock/orders";

/**
 * Mock aggregation for the admin dashboard. The real backend should compute the
 * same figures in the database; definitions are documented on DashboardSummary.
 */

const ORDER_STATUSES: OrderStatus[] = ["received", "preparing", "on_the_way", "delivered", "cancelled"];
const TOP_N = 5;
const LOW_STOCK_THRESHOLD = 12;

const customerById = new Map(mockCustomers.map((c) => [c.id, c]));
const productById = new Map(mockProducts.map((p) => [p.id, p]));
const categoryById = new Map(mockCategories.map((c) => [c.id, c]));

/** Mock placedAt values carry the store offset, so the date part is the local calendar date. */
const localDate = (order: Order) => order.placedAt.slice(0, 10);
/** Items after discounts and adjustments, excluding tax and shipping (same basis for tax-inclusive and -exclusive orders). */
const netSales = (order: Order) => orderNetSales(order);
/** Money addition in minor units (no float drift across thousands of orders). */
const addMoney = (a: number, b: number) => sumMoney([a, b]);

const ordersIn = (range: DateRange) =>
  mockOrders.filter((o) => {
    const d = localDate(o);
    return d >= range.from && d <= range.to;
  });

function kpis(orders: Order[]) {
  const valid = orders.filter((o) => o.status !== "cancelled");
  const revenue = sumMoney(valid.map(netSales));
  // Classified against every order (an order in this range can be a repeat of one placed before it).
  const typeOf = orderTypeResolver(mockOrders);
  return {
    revenue,
    orders: valid.length,
    // Registered customers only; walk-in orders have no account.
    activeCustomers: new Set(valid.flatMap((o) => (o.customerId ? [o.customerId] : []))).size,
    averageOrderValue: valid.length ? Math.round(revenue / valid.length) : 0,
    newOrders: valid.filter((o) => typeOf(o) === "first").length,
    repeatOrders: valid.filter((o) => typeOf(o) === "repeat").length,
  };
}

function series(orders: Order[], range: DateRange, bucketDays: number): SeriesPoint[] {
  const buckets = Math.ceil(rangeLength(range) / bucketDays);
  const values = new Array<number>(buckets).fill(0);
  const start = Date.parse(`${range.from}T00:00:00Z`);
  for (const o of orders) {
    if (o.status === "cancelled") continue;
    const day = Math.round((Date.parse(`${localDate(o)}T00:00:00Z`) - start) / 86_400_000);
    const b = Math.floor(day / bucketDays);
    values[b] = addMoney(values[b], netSales(o));
  }
  return values.map((value, i) => ({ date: addDays(range.from, i * bucketDays), value }));
}

type Totals = Map<string, { revenue: number; units: number }>;

function totals(orders: Order[]) {
  const products: Totals = new Map();
  const categories: Totals = new Map();
  const customers: Totals = new Map();
  const add = (map: Totals, key: string, revenue: number, units = 0) => {
    const t = map.get(key) ?? { revenue: 0, units: 0 };
    t.revenue = addMoney(t.revenue, revenue);
    t.units += units;
    map.set(key, t);
  };
  for (const o of orders) {
    if (o.status === "cancelled") continue;
    if (o.customerId) add(customers, o.customerId, netSales(o));
    for (const item of o.items) {
      add(products, item.productId, lineNetSales(item), item.quantity);
      const categoryIds = productById.get(item.productId)?.categoryIds ?? [];
      for (const categoryId of categoryIds.length ? categoryIds : ["uncategorized"]) {
        add(categories, categoryId, lineNetSales(item), item.quantity);
      }
    }
  }
  return { products, categories, customers };
}

function rank(
  current: Totals,
  previous: Totals | undefined,
  describe: (id: string, t: { revenue: number; units: number }) => Pick<RankingItem, "name" | "detail">,
): RankingItem[] {
  return [...current]
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .slice(0, TOP_N)
    .map(([id, t]) => ({ id, ...describe(id, t), revenue: t.revenue, previousRevenue: previous ? (previous.get(id)?.revenue ?? 0) : undefined }));
}

export async function getMockDashboard({ range, compare }: DashboardQuery): Promise<DashboardSummary> {
  const current = ordersIn(range);
  const previous = compare ? ordersIn(compare) : undefined;
  const bucketDays = rangeLength(range) > 92 ? 7 : 1;

  const now = kpis(current);
  const before = previous ? kpis(previous) : undefined;
  const t = totals(current);
  const p = previous ? totals(previous) : undefined;
  const units = (n: number) => `${n.toLocaleString("en-IN")} units`;

  return {
    range,
    compare,
    granularity: bucketDays === 1 ? "day" : "week",
    kpis: {
      revenue: { current: now.revenue, previous: before?.revenue },
      orders: { current: now.orders, previous: before?.orders },
      activeCustomers: { current: now.activeCustomers, previous: before?.activeCustomers },
      averageOrderValue: { current: now.averageOrderValue, previous: before?.averageOrderValue },
      newOrders: { current: now.newOrders, previous: before?.newOrders },
      repeatOrders: { current: now.repeatOrders, previous: before?.repeatOrders },
    },
    revenueSeries: {
      current: series(current, range, bucketDays),
      previous: previous && compare ? series(previous, compare, bucketDays) : undefined,
    },
    orderStatus: ORDER_STATUSES.map((status) => ({ status, count: current.filter((o) => o.status === status).length })),
    topProducts: rank(t.products, p?.products, (id, x) => ({ name: productById.get(id)?.name ?? id, detail: units(x.units) })),
    topCategories: rank(t.categories, p?.categories, (id, x) => ({ name: categoryById.get(id)?.name ?? "Uncategorised", detail: units(x.units) })),
    topCustomers: rank(t.customers, p?.customers, (id) => {
      const c = customerById.get(id);
      return { name: c?.companyName ?? id, detail: c?.addresses[0]?.city };
    }),
    recentOrders: [...current]
      .sort((a, b) => b.placedAt.localeCompare(a.placedAt))
      .slice(0, TOP_N)
      .map((o) => ({
        id: o.id,
        number: o.number,
        customerName: o.customerName,
        location: o.shippingAddress?.city ?? "Store pickup",
        total: o.totals.total,
        status: o.status,
        placedAt: o.placedAt,
      })),
    lowStock: mockProducts
      .filter((pr) => pr.stock.status !== "backorder" && (pr.stock.quantity ?? Infinity) <= LOW_STOCK_THRESHOLD)
      .sort((a, b) => (a.stock.quantity ?? 0) - (b.stock.quantity ?? 0))
      .map((pr) => ({ productId: pr.id, name: pr.name, quantity: pr.stock.quantity ?? 0, unitLabel: pr.unitLabel })),
    pendingApprovals: mockCustomers.filter((c) => c.status === "pending").length,
  };
}

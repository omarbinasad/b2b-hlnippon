/**
 * Report figures, from orders. Pure and tested, so every total on the reports screen agrees. The backend should compute
 * the same definitions in the database. Cancelled orders are left out of sales, and shown only in the status counts.
 */
import { fromMinor, toMinor } from "../orders/calc.ts";

export interface ReportOrderItem {
  productId?: string;
  name: string;
  quantity: number;
  lineTotal: number;
  lineNet?: number;
}

export interface ReportOrder {
  customerId?: string;
  customerName: string;
  status: string;
  placedAt: string;
  items: ReportOrderItem[];
  totals: { total: number; itemsTotal: number; itemsNet?: number; discountTotal: number; refundedTotal: number; netTotal: number; shippingTotal: number; taxTotal: number };
  shippingAddress?: { prefecture: string };
  coupon?: { amount: number };
}

export interface ReportRow {
  label: string;
  orders?: number;
  units?: number;
  sales: number;
}

export interface ReportSummary {
  totalSales: number;
  netSales: number;
  orders: number;
  averageOrderValue: number;
  customers: number;
  newCustomers: number;
  returningCustomers: number;
  repeatOrders: number;
  discounts: number;
  couponDiscounts: number;
  refunds: number;
  shipping: number;
  tax: number;
}

export interface ReportContext {
  /** Lookups so this stays pure. */
  categoryOf: (productId?: string) => string;
  groupOf: (customerId?: string) => string;
}

const net = (o: ReportOrder) => o.totals.itemsNet ?? o.totals.itemsTotal;
const sum = (values: number[]) => fromMinor(values.reduce((a, b) => a + toMinor(b), 0));
const day = (o: ReportOrder) => o.placedAt.slice(0, 10);

export const inRange = (o: ReportOrder, range: { from: string; to: string }) => day(o) >= range.from && day(o) <= range.to;

/** `all` is every order ever: whether a customer is new depends on what they bought before the range. */
export function reportSummary(all: ReportOrder[], range: { from: string; to: string }): ReportSummary {
  const valid = all.filter((o) => inRange(o, range) && o.status !== "cancelled");
  const netSales = sum(valid.map(net));
  const firstOrder = new Map<string, string>();
  for (const o of all) {
    if (o.status === "cancelled" || !o.customerId) continue;
    const seen = firstOrder.get(o.customerId);
    if (!seen || day(o) < seen) firstOrder.set(o.customerId, day(o));
  }
  const buyers = new Set(valid.flatMap((o) => (o.customerId ? [o.customerId] : [])));
  const newCustomers = [...buyers].filter((id) => (firstOrder.get(id) ?? "") >= range.from).length;
  const seenBefore = new Set<string>();
  let repeatOrders = 0;
  for (const o of [...all].filter((x) => x.status !== "cancelled" && x.customerId).sort((a, b) => a.placedAt.localeCompare(b.placedAt))) {
    if (seenBefore.has(o.customerId!) && inRange(o, range)) repeatOrders += 1;
    seenBefore.add(o.customerId!);
  }
  return {
    totalSales: sum(valid.map((o) => o.totals.total)),
    netSales,
    orders: valid.length,
    averageOrderValue: valid.length ? fromMinor(Math.round(toMinor(netSales) / valid.length)) : 0,
    customers: buyers.size,
    newCustomers,
    returningCustomers: buyers.size - newCustomers,
    repeatOrders,
    discounts: sum(valid.map((o) => o.totals.discountTotal)),
    couponDiscounts: sum(valid.map((o) => o.coupon?.amount ?? 0)),
    refunds: sum(valid.map((o) => o.totals.refundedTotal)),
    shipping: sum(valid.map((o) => o.totals.shippingTotal)),
    tax: sum(valid.map((o) => o.totals.taxTotal)),
  };
}

function ranked(rows: Map<string, { orders: Set<number> | null; units: number; sales: number }>, limit?: number): ReportRow[] {
  const out = [...rows.entries()]
    .map(([label, r]) => ({ label, orders: r.orders?.size, units: r.units || undefined, sales: fromMinor(r.sales) }))
    .sort((a, b) => b.sales - a.sales || a.label.localeCompare(b.label));
  return limit ? out.slice(0, limit) : out;
}

function byOrder(orders: ReportOrder[], label: (o: ReportOrder) => string, limit?: number) {
  const rows = new Map<string, { orders: Set<number>; units: number; sales: number }>();
  orders.forEach((o, i) => {
    const key = label(o);
    const r = rows.get(key) ?? { orders: new Set<number>(), units: 0, sales: 0 };
    r.orders.add(i);
    r.sales += toMinor(net(o));
    rows.set(key, r);
  });
  return ranked(rows, limit);
}

function byItem(orders: ReportOrder[], label: (i: ReportOrderItem) => string, limit?: number) {
  const rows = new Map<string, { orders: Set<number>; units: number; sales: number }>();
  orders.forEach((o, idx) => {
    for (const item of o.items) {
      const key = label(item);
      const r = rows.get(key) ?? { orders: new Set<number>(), units: 0, sales: 0 };
      r.orders.add(idx);
      r.units += item.quantity;
      r.sales += toMinor(item.lineNet ?? item.lineTotal);
      rows.set(key, r);
    }
  });
  return ranked(rows, limit);
}

export function reportBreakdowns(all: ReportOrder[], range: { from: string; to: string }, ctx: ReportContext) {
  const inPeriod = all.filter((o) => inRange(o, range));
  const valid = inPeriod.filter((o) => o.status !== "cancelled");
  const statuses = new Map<string, number>();
  for (const o of inPeriod) statuses.set(o.status, (statuses.get(o.status) ?? 0) + 1);
  return {
    topProducts: byItem(valid, (i) => i.name, 20),
    categories: byItem(valid, (i) => ctx.categoryOf(i.productId)),
    topCustomers: byOrder(valid, (o) => o.customerName, 20),
    groups: byOrder(valid, (o) => ctx.groupOf(o.customerId)),
    locations: byOrder(valid, (o) => o.shippingAddress?.prefecture ?? "Store pickup"),
    statuses: [...statuses.entries()].map(([status, count]) => ({ status, count })),
    monthly: byOrder(valid, (o) => o.placedAt.slice(0, 7)).sort((a, b) => a.label.localeCompare(b.label)),
  };
}

/** Quotes values and neutralises spreadsheet formulas (=, +, -, @), since some values come from customers. */
export function toCsv(headers: string[], rows: (string | number | undefined)[][]) {
  const cell = (v: string | number | undefined) => {
    if (v === undefined) return "";
    if (typeof v === "number") return String(v);
    const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
    return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  return [headers, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
}

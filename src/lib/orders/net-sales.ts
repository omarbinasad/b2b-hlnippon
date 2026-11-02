/**
 * Net sales = items after discounts, EXCLUDING tax, shipping and refunds of shipping.
 * Pure helpers used by the dashboard so tax-inclusive and tax-exclusive orders are
 * reported on the same basis. Only type imports, so `npm test` can load this file.
 *
 * - Orders with a tax snapshot carry `totals.itemsNet` and each item's `lineNet`
 *   (tax removed when prices included tax; equal to the amount otherwise).
 * - Older orders were always tax-exclusive, so their `itemsTotal` / `lineTotal` are already net.
 */
import type { OrderItem, OrderTotals } from "@/lib/types";

export const orderNetSales = (order: { totals: Pick<OrderTotals, "itemsTotal" | "itemsNet"> }) => order.totals.itemsNet ?? order.totals.itemsTotal;

export const lineNetSales = (item: Pick<OrderItem, "lineTotal" | "lineNet">) => item.lineNet ?? item.lineTotal;

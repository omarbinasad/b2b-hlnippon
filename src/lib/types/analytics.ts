import type { ID, ISODateString, Money } from "./common";
import type { OrderStatus } from "./order";

/** Inclusive range of calendar dates ("YYYY-MM-DD") in the store time zone. */
export interface DateRange {
  from: string;
  to: string;
}

export interface DashboardQuery {
  range: DateRange;
  /** Omit for no comparison. */
  compare?: DateRange;
}

export interface Kpi {
  current: number;
  /** Value for the comparison period, when one was requested. */
  previous?: number;
}

export interface SeriesPoint {
  /** First day of the bucket. */
  date: string;
  value: Money;
}

export interface RankingItem {
  id: ID;
  name: string;
  /** Secondary text, e.g. "420 units" or a location. */
  detail?: string;
  revenue: Money;
  previousRevenue?: Money;
}

export interface RecentOrderSummary {
  id: ID;
  number: string;
  customerName: string;
  location: string;
  total: Money;
  status: OrderStatus;
  placedAt: ISODateString;
}

export interface LowStockItem {
  productId: ID;
  name: string;
  quantity: number;
  unitLabel: string;
}

export interface DashboardSummary {
  range: DateRange;
  compare?: DateRange;
  /** Bucket size of the revenue series. */
  granularity: "day" | "week";
  kpis: {
    /** Net sales: item totals + adjustments, excluding VAT, shipping and cancelled orders. */
    revenue: Kpi;
    /** Orders placed, excluding cancelled. */
    orders: Kpi;
    /** Customers with at least one non-cancelled order. */
    activeCustomers: Kpi;
    averageOrderValue: Kpi;
    /** Non-cancelled orders that were the customer's first (see src/lib/orders/order-type.ts) — i.e. new customers ordering. */
    newOrders: Kpi;
    /** Non-cancelled orders from customers who had ordered before. Walk-in orders are in neither. */
    repeatOrders: Kpi;
  };
  revenueSeries: { current: SeriesPoint[]; previous?: SeriesPoint[] };
  /** All orders placed in the range, by status (including cancelled). */
  orderStatus: { status: OrderStatus; count: number }[];
  topProducts: RankingItem[];
  topCategories: RankingItem[];
  topCustomers: RankingItem[];
  recentOrders: RecentOrderSummary[];
  /** Current stock — not affected by the date range. */
  lowStock: LowStockItem[];
  /** Applications awaiting review — not affected by the date range. */
  pendingApprovals: number;
}

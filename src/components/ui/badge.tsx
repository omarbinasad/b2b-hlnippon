import type { ReactNode } from "react";
import { accountStatusLabels } from "@/lib/customers/status";
import { stockLabels } from "@/lib/format";
import { orderStatusLabels, paymentStatusLabels } from "@/lib/orders/status";
import type { AccountStatus, OrderStatus, PaymentStatus, StockStatus } from "@/lib/types";
import { cx } from "@/lib/cx";

export type Tone = "neutral" | "brand" | "success" | "warning" | "danger" | "info";

const tones: Record<Tone, string> = {
  neutral: "bg-surface-muted text-muted",
  brand: "bg-brand-soft text-brand",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={cx("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", tones[tone])}>
      {children}
    </span>
  );
}

const orderTones: Record<OrderStatus, Tone> = {
  received: "warning",
  preparing: "info",
  on_the_way: "brand",
  delivered: "success",
  cancelled: "neutral",
};

const paymentTones: Record<PaymentStatus, Tone> = {
  unpaid: "warning",
  invoiced: "info",
  paid: "success",
  partially_refunded: "warning",
  refunded: "neutral",
};

export const accountTones: Record<AccountStatus, Tone> = {
  pending: "warning",
  approved: "success",
  rejected: "neutral",
  suspended: "danger",
};

const stockTones: Record<StockStatus, Tone> = {
  in_stock: "success",
  low_stock: "warning",
  out_of_stock: "danger",
  backorder: "info",
};

export const OrderStatusBadge = ({ status }: { status: OrderStatus }) => (
  <Badge tone={orderTones[status]}>{orderStatusLabels[status]}</Badge>
);
export const PaymentStatusBadge = ({ status }: { status: PaymentStatus }) => (
  <Badge tone={paymentTones[status]}>{paymentStatusLabels[status]}</Badge>
);
export const AccountStatusBadge = ({ status }: { status: AccountStatus }) => (
  <Badge tone={accountTones[status]}>{accountStatusLabels[status]}</Badge>
);
export const StockBadge = ({ status }: { status: StockStatus }) => (
  <Badge tone={stockTones[status]}>{stockLabels[status]}</Badge>
);

/** Runtime lists of enum-like values, for URL validation and filter options. */
import type {
  AccountStatus,
  NotificationKind,
  OrderStatus,
  PaymentStatus,
  ProductStatus,
  ReminderChannel,
  ReminderType,
  StockStatus,
} from "@/lib/types";
import { humanize, stockLabels } from "@/lib/format";
import { accountStatusLabels } from "@/lib/customers/status";
import { orderStatusLabels, paymentStatusLabels } from "@/lib/orders/status";

export const orderStatuses = ["received", "preparing", "on_the_way", "delivered", "cancelled"] as const satisfies readonly OrderStatus[];
export const paymentStatuses = ["unpaid", "invoiced", "paid", "partially_refunded", "refunded"] as const satisfies readonly PaymentStatus[];
export const accountStatuses = ["pending", "approved", "rejected", "suspended"] as const satisfies readonly AccountStatus[];
export const stockStatuses = ["in_stock", "low_stock", "out_of_stock", "backorder"] as const satisfies readonly StockStatus[];
export const productStatuses = ["draft", "published", "archived"] as const satisfies readonly ProductStatus[];
export const reminderTypes = ["reorder", "order_cutoff", "payment_due"] as const satisfies readonly ReminderType[];
export const reminderChannels = ["email", "sms", "whatsapp"] as const satisfies readonly ReminderChannel[];
export const notificationKinds = ["order", "delivery", "account", "reminder"] as const satisfies readonly NotificationKind[];

/** `{ value, label }` options for a filter select. */
export const options = (values: readonly string[], label: (v: string) => string = humanize) =>
  values.map((value) => ({ value, label: label(value) }));

export const stockOptions = options(stockStatuses, (v) => stockLabels[v as StockStatus]);
export const orderStatusOptions = options(orderStatuses, (v) => orderStatusLabels[v as OrderStatus]);
export const paymentStatusOptions = options(paymentStatuses, (v) => paymentStatusLabels[v as PaymentStatus]);
export const accountStatusOptions = options(accountStatuses, (v) => accountStatusLabels[v as AccountStatus]);
export const activeOptions = [
  { value: "yes", label: "Active" },
  { value: "no", label: "Inactive" },
];

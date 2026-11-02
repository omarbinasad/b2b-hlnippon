import Link from "next/link";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/ui/badge";
import { SortHeader } from "@/components/ui/list-controls";
import { Table } from "@/components/ui/table";
import type { SortDir } from "@/lib/data/repositories";
import { formatDate, formatMoney } from "@/lib/format";
import type { Order } from "@/lib/types";

interface OrderTableProps {
  orders: Order[];
  /** Link order numbers to the customer portal detail page. */
  linkToDetail?: boolean;
  /** Adds a Customer column (admin). */
  showCustomer?: boolean;
  /** Makes column headers sort links. */
  sorting?: { sort: string; dir?: SortDir; pathname: string; params: Record<string, string> };
}

export function OrderTable({ orders, linkToDetail, showCustomer, sorting }: OrderTableProps) {
  const header = (label: string, field: string, defaultDir: SortDir = "asc", className?: string) =>
    sorting ? (
      <SortHeader label={label} field={field} defaultDir={defaultDir} className={className} {...sorting} />
    ) : (
      <th scope="col" className={className}>{label}</th>
    );

  return (
    <Table caption="Orders">
      <thead>
        <tr>
          {header("Order", "number")}
          {showCustomer && header("Customer", "customer")}
          {header("Placed", "placed", "desc")}
          {header("Status", "status")}
          <th scope="col">Payment</th>
          {header("Total", "total", "desc", "text-right")}
        </tr>
      </thead>
      <tbody>
        {orders.map((order) => (
          <tr key={order.id}>
            <td className="font-medium whitespace-nowrap">
              {linkToDetail ? (
                <Link href={`/account/orders/${order.id}`} className="text-brand hover:underline">
                  {order.number}
                </Link>
              ) : (
                order.number
              )}
            </td>
            {showCustomer && (
              <td>
                {order.customerName}
                <span className="block text-xs text-muted">{order.shippingAddress?.city ?? "Store pickup"}</span>
              </td>
            )}
            <td className="whitespace-nowrap">{formatDate(order.placedAt)}</td>
            <td><OrderStatusBadge status={order.status} /></td>
            <td><PaymentStatusBadge status={order.paymentStatus} /></td>
            <td className="text-right whitespace-nowrap tabular-nums">{formatMoney(order.totals.total)}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

import { AllowedLink } from "@/components/admin/capabilities-context";
import { Card } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
import { Table } from "@/components/ui/table";
import { formatDateTime, stockLabels } from "@/lib/format";
import type { Paginated, StockInfo, StockMovement, StockMovementSource } from "@/lib/types";

const sourceLabels: Record<StockMovementSource, string> = {
  product_edit: "Product edited",
  order_page: "Changed from an order",
  refund_restock: "Refund restock",
  inventory_adjust: "Inventory adjustment",
};

const show = (s: StockInfo) => (s.quantity !== undefined ? `${s.quantity} (${stockLabels[s.status]})` : stockLabels[s.status]);

/** Stock change history for a product and its options (newest first). */
export function StockHistory({ movements, pathname, searchParams }: { movements: Paginated<StockMovement>; pathname: string; searchParams: Record<string, string | undefined> }) {
  return (
    <Card
      title="Stock history"
      description="Changes made on this product, from order pages and by refund restocks since the demo server started. Stock reserved or deducted by orders is the backend's job and not shown in this demo."
    >
      {movements.items.length ? (
        <>
          <Table caption="Stock history" density="compact">
            <thead>
              <tr>
                <th scope="col">When / who</th>
                <th scope="col">Option</th>
                <th scope="col">Change</th>
                <th scope="col">Source</th>
              </tr>
            </thead>
            <tbody>
              {movements.items.map((m) => (
                <tr key={m.id}>
                  <td className="whitespace-nowrap">
                    {formatDateTime(m.at)}
                    <span className="block text-xs text-muted">{m.byName}</span>
                  </td>
                  <td>
                    {m.variationLabel ?? "Product"}
                    <span className="block text-xs text-muted">{m.sku}</span>
                  </td>
                  <td className="tabular-nums">
                    {show(m.before)} → {show(m.after)}
                    {m.change !== undefined && m.change !== 0 && <span className={m.change < 0 ? "block text-xs text-danger" : "block text-xs text-success"}>{m.change > 0 ? `+${m.change}` : m.change}</span>}
                  </td>
                  <td>
                    {sourceLabels[m.source]}
                    {m.orderId && (
                      <AllowedLink href={`/admin/orders/${m.orderId}`} className="block text-xs text-brand hover:underline">Order {m.orderNumber ?? m.orderId}</AllowedLink>
                    )}
                    {m.note && m.source !== "product_edit" && <span className="block text-xs text-muted">“{m.note}”</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
          <div className="mt-4">
            <Pagination page={movements.page} totalPages={movements.totalPages} pathname={pathname} searchParams={searchParams} />
          </div>
        </>
      ) : (
        <p className="text-sm text-muted">No stock changes recorded yet.</p>
      )}
    </Card>
  );
}

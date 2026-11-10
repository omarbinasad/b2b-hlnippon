import { AllowedLink } from "@/components/admin/capabilities-context";
import type { Metadata } from "next";
import { DemoEditingNotice } from "@/components/admin/demo-notice";
import { InventoryNav } from "@/components/admin/inventory/inventory-nav";
import { EmptyState } from "@/components/ui/feedback";
import { ListToolbar } from "@/components/ui/list-controls";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { Table } from "@/components/ui/table";
import { repositories } from "@/lib/data";
import { formatDateTime, stockLabels } from "@/lib/format";
import { flatParams, param } from "@/lib/list-params";
import type { StockInfo } from "@/lib/types";

export const metadata: Metadata = { title: "Stock history" };

const PATH = "/admin/inventory/history";
const show = (s: StockInfo) => (s.quantity !== undefined ? String(s.quantity) : stockLabels[s.status]);
const SOURCE = { product_edit: "Product edited", order_page: "From an order", refund_restock: "Refund restock", inventory_adjust: "Adjustment" } as const;

export default async function StockHistoryPage({ searchParams }: PageProps<"/admin/inventory/history">) {
  const sp = await searchParams;
  const result = await repositories.products.allStockMovements({ search: param(sp, "q") || undefined, from: param(sp, "from") || undefined, to: param(sp, "to") || undefined, page: Number(param(sp, "page")) || 1, perPage: 25 });
  const params = flatParams(sp);
  return (
    <>
      <PageHeader title="Inventory" description="Every stock change since the demo server started." />
      <InventoryNav current="history" />
      <ListToolbar pathname={PATH} params={params} searchLabel="Search history" searchPlaceholder="Product, SKU, person or reason" dates={{ fromLabel: "From", toLabel: "To" }} total={result.total} page={result.page} perPage={result.perPage} />
      <div className="space-y-6">
        {result.items.length ? (
          <Table caption="Stock history">
            <thead>
              <tr>
                <th scope="col">When</th>
                <th scope="col">Product</th>
                <th scope="col">Change</th>
                <th scope="col">Source</th>
                <th scope="col">Reason</th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((m) => (
                <tr key={m.id}>
                  <td className="whitespace-nowrap">{formatDateTime(m.at)}<span className="block text-xs text-muted">{m.byName}</span></td>
                  <td className="min-w-48"><AllowedLink href={`/admin/products/${m.productId}/edit`} className="font-medium text-brand hover:underline">{m.productName}</AllowedLink>{m.variationLabel && <span className="block text-xs text-muted">{m.variationLabel}</span>}</td>
                  <td className="whitespace-nowrap tabular-nums">{show(m.before)} → {show(m.after)}</td>
                  <td className="whitespace-nowrap">{SOURCE[m.source]}{m.orderNumber && <span className="block text-xs text-muted">{m.orderNumber}</span>}</td>
                  <td className="text-sm">{m.note ?? <span className="text-muted">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : <EmptyState title="No stock changes yet" description="Adjustments, product edits and refund restocks appear here." />}
        <Pagination page={result.page} totalPages={result.totalPages} pathname={PATH} searchParams={params} />
        <DemoEditingNotice />
      </div>
    </>
  );
}

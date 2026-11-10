import { Can } from "@/components/admin/capabilities-context";
import type { Metadata } from "next";
import Link from "next/link";
import { DemoEditingNotice } from "@/components/admin/demo-notice";
import { AdjustStock } from "@/components/admin/inventory/adjust-stock";
import { InventoryNav } from "@/components/admin/inventory/inventory-nav";
import { StockBadge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { ListToolbar } from "@/components/ui/list-controls";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { Table } from "@/components/ui/table";
import { repositories } from "@/lib/data";
import { stockOptions, stockStatuses } from "@/lib/enums";
import { formatNumber } from "@/lib/format";
import { flatParams, oneOf, param } from "@/lib/list-params";

export const metadata: Metadata = { title: "Inventory" };

const PATH = "/admin/inventory";

export default async function InventoryPage({ searchParams }: PageProps<"/admin/inventory">) {
  const sp = await searchParams;
  const [result, counts] = await Promise.all([
    repositories.products.inventory({ search: param(sp, "q") || undefined, stockStatus: oneOf(param(sp, "stock"), stockStatuses), page: Number(param(sp, "page")) || 1, perPage: 25 }),
    repositories.products.inventoryCounts(),
  ]);
  const params = flatParams(sp);
  return (
    <>
      <PageHeader title="Inventory" description="Stock across every product and option. Out of stock and low stock come first." />
      <InventoryNav current="stock" />
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Stock lines" value={formatNumber(counts.total)} />
        <StatCard label="Low stock" value={formatNumber(counts.low)} />
        <StatCard label="Out of stock" value={formatNumber(counts.out)} />
      </div>
      <ListToolbar
        pathname={PATH}
        params={params}
        searchLabel="Search stock"
        searchPlaceholder="Product, option or SKU"
        filters={[{ name: "stock", label: "Availability", options: stockOptions, allLabel: "All" }]}
        total={result.total}
        page={result.page}
        perPage={result.perPage}
      />
      <div className="space-y-6">
        {result.items.length ? (
          <Table caption="Stock levels">
            <thead>
              <tr>
                <th scope="col">Product</th>
                <th scope="col">SKU</th>
                <th scope="col">Availability</th>
                <th scope="col" className="text-right">Count</th>
                <th scope="col" className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((r) => (
                <tr key={r.variationId ?? r.productId}>
                  <td className="min-w-52">
                    <Link href={`/admin/products/${r.productId}/edit`} className="font-medium text-brand hover:underline">{r.productName}</Link>
                    {r.variationLabel && <span className="block text-xs text-muted">{r.variationLabel}</span>}
                  </td>
                  <td className="text-sm break-all">{r.sku}</td>
                  <td><StockBadge status={r.stock.status} /></td>
                  <td className="text-right tabular-nums">{r.mode === "quantity" ? formatNumber(r.stock.quantity ?? 0) : <span className="text-xs text-muted">Not counted</span>}</td>
                  <td className="text-right"><Can cap="inventory.edit"><AdjustStock row={r} /></Can></td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : <EmptyState title="Nothing found" description="Try another search or availability." />}
        <Pagination page={result.page} totalPages={result.totalPages} pathname={PATH} searchParams={params} />
        <DemoEditingNotice />
      </div>
    </>
  );
}

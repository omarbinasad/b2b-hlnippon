import { Can } from "@/components/admin/capabilities-context";
import type { Metadata } from "next";
import Link from "next/link";
import { siteConfig } from "@/config/site";
import { ActionNotice, DemoEditingNotice } from "@/components/admin/demo-notice";
import { ProductRowActions } from "@/components/admin/products/row-actions";
import { ProductImage } from "@/components/product/product-image";
import { Badge, StockBadge, type Tone } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, Notice } from "@/components/ui/feedback";
import { Icon } from "@/components/ui/icons";
import { ListToolbar, SortHeader } from "@/components/ui/list-controls";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { Table } from "@/components/ui/table";
import { originCountryName } from "@/lib/countries";
import { repositories } from "@/lib/data";
import type { ProductSortField } from "@/lib/data/repositories";
import { productStatuses, stockOptions, stockStatuses } from "@/lib/enums";
import { formatMoney, formatNumber, formatWeight, humanize } from "@/lib/format";
import { flatParams, listHref, listState, oneOf, param } from "@/lib/list-params";
import type { AdminProductRow, ProductStatus } from "@/lib/types";

export const metadata: Metadata = { title: "Products" };

const PATH = "/admin/products";
const SORTS = ["name", "sku", "price", "stock", "updated"] as const satisfies readonly ProductSortField[];

const statusTone: Record<ProductStatus, Tone> = { published: "success", draft: "warning", archived: "neutral" };
const visibilityLabel = { visible: undefined, catalog: "Shop only", search: "Search only", hidden: "Hidden" } as const;

function Price({ p }: { p: AdminProductRow }) {
  if (!p.price) return <Badge tone="warning">No price</Badge>;
  if (p.price.min !== p.price.max) {
    return <span className="whitespace-nowrap">{formatMoney(p.price.min)}–{formatMoney(p.price.max)}</span>;
  }
  return p.salePrice !== undefined ? (
    <span className="whitespace-nowrap">
      <span className="font-medium text-danger">{formatMoney(p.salePrice)}</span>{" "}
      <s className="text-xs text-muted">{formatMoney(p.price.min)}</s>
      <span className="sr-only"> (sale price; regular {formatMoney(p.price.min)})</span>
    </span>
  ) : (
    <span className="whitespace-nowrap">{formatMoney(p.price.min)}</span>
  );
}

function Stock({ p }: { p: AdminProductRow }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <StockBadge status={p.stock.status} />
      {p.stock.quantity !== undefined && <span className="text-xs text-muted tabular-nums">{formatNumber(p.stock.quantity)}</span>}
    </span>
  );
}

function Status({ p }: { p: AdminProductRow }) {
  return (
    <span className="inline-flex flex-col items-start gap-0.5">
      <Badge tone={statusTone[p.status]}>{humanize(p.status)}</Badge>
      {visibilityLabel[p.visibility] && <span className="text-xs text-muted">{visibilityLabel[p.visibility]}</span>}
    </span>
  );
}

const typeLabel = (p: AdminProductRow) => (
  <>
    {p.type === "variable" ? `Variable · ${p.variationCount} option${p.variationCount === 1 ? "" : "s"}` : "Simple"}
    {p.unpricedVariations > 0 && <span className="font-medium text-warning"> · {p.unpricedVariations} without price</span>}
  </>
);

export default async function AdminProductsPage({ searchParams }: PageProps<"/admin/products">) {
  const sp = await searchParams;
  const state = listState(sp, SORTS, "name");
  const categories = await repositories.categories.list({ perPage: 48 });
  const products = await repositories.products.adminList({
    ...state,
    categorySlug: oneOf(param(sp, "category"), categories.items.map((c) => c.slug)),
    type: oneOf(param(sp, "type"), ["simple", "variable"] as const),
    stockStatus: oneOf(param(sp, "stock"), stockStatuses),
    status: oneOf(param(sp, "status"), productStatuses),
    pricing: oneOf(param(sp, "pricing"), ["missing", "set"] as const),
    perPage: 20,
  });
  const missingPrices = (await repositories.products.adminList({ pricing: "missing", perPage: 1 })).total;
  const params = flatParams(sp);
  const exportParams = Object.fromEntries(Object.entries(params).filter(([k]) => k !== "notice"));
  const sorting = { sort: state.sort, dir: state.dir, pathname: PATH, params };
  const returnTo = listHref(PATH, params, { notice: undefined });

  return (
    <>
      <PageHeader
        title="Products"
        description="Catalog, variations, stock levels and quantity rules."
        actions={
          <>
            <Can cap="products.export"><ButtonLink href={`/admin/products/export?${new URLSearchParams(exportParams)}` as "/admin/products"} prefetch={false} variant="secondary">Export CSV</ButtonLink></Can>
            <ButtonLink href="/admin/categories" variant="secondary">
              <Icon name="folder" className="size-4" /> Categories
            </ButtonLink>
            <Can cap="products.create"><ButtonLink href="/admin/products/new">
              <Icon name="plus" className="size-4" /> Add product
            </ButtonLink></Can>
          </>
        }
      />
      <div className="mb-4">
        <DemoEditingNotice images />
      </div>
      <ActionNotice notice={param(sp, "notice")} />
      {missingPrices > 0 && param(sp, "pricing") !== "missing" && (
        <div className="mb-4">
          <Notice tone="warning" title={`${formatNumber(missingPrices)} product${missingPrices === 1 ? "" : "s"} can't be ordered: no ${siteConfig.currency} price`}>
            Imported products keep their old-store price for reference only — it is in another currency and is never
            converted or used. Enter a local selling price on each product (wholesale rules apply to that price).{" "}
            <Link href="/admin/products?pricing=missing" className="font-medium text-primary underline">
              Show them
            </Link>
          </Notice>
        </div>
      )}

      <ListToolbar
        pathname={PATH}
        params={params}
        searchLabel="Search products"
        searchPlaceholder="Name, SKU or variation SKU"
        filters={[
          { name: "category", label: "Category", options: categories.items.map((c) => ({ value: c.slug, label: c.path })), allLabel: "All categories" },
          { name: "type", label: "Type", options: [{ value: "simple", label: "Simple" }, { value: "variable", label: "Variable" }], allLabel: "All types" },
          { name: "stock", label: "Stock", options: stockOptions, allLabel: "Any stock" },
          { name: "pricing", label: "Price", options: [{ value: "missing", label: "No local price" }, { value: "set", label: "Priced" }], allLabel: "Any price" },
          { name: "status", label: "Status", options: productStatuses.map((s) => ({ value: s, label: humanize(s) })), allLabel: "Published & draft" },
        ]}
        total={products.total}
        page={products.page}
        perPage={products.perPage}
      />

      {products.items.length === 0 ? (
        <EmptyState
          title="No products match these filters"
          description="Try another search or filter. Archived products only appear when you filter by “Archived”."
          action={<Can cap="products.create"><ButtonLink href="/admin/products/new">Add product</ButtonLink></Can>}
        />
      ) : (
        <>
          {/* Phones: cards */}
          <ul className="space-y-3 md:hidden">
            {products.items.map((p) => (
              <li key={p.id} className="rounded-ui border border-line bg-surface p-3">
                <div className="flex gap-3">
                  <ProductImage image={p.image} sizes="64px" className="size-16 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{p.name}</p>
                    <p className="text-xs text-muted">{p.sku} · {typeLabel(p)}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm">
                      <Price p={p} />
                      <Stock p={p} />
                    </div>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2 border-t border-line pt-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                    <Status p={p} />
                    <span>{formatWeight(p.weight)}</span>
                    {p.originCountry && <span>{originCountryName(p.originCountry)}</span>}
                  </div>
                  <ProductRowActions product={p} returnTo={returnTo} />
                </div>
              </li>
            ))}
          </ul>

          {/* Larger screens: table */}
          <div className="hidden md:block">
            <Table caption="Products" density="compact">
              <thead>
                <tr>
                  <th scope="col" className="w-14"><span className="sr-only">Image</span></th>
                  <SortHeader label="Product" field="name" {...sorting} />
                  <SortHeader label="SKU" field="sku" {...sorting} />
                  <th scope="col">Category</th>
                  <SortHeader label="Price" field="price" {...sorting} />
                  <SortHeader label="Stock" field="stock" {...sorting} />
                  <th scope="col">Weight · origin</th>
                  <th scope="col">Status</th>
                  <th scope="col"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {products.items.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <ProductImage image={p.image} sizes="48px" className="size-12" />
                    </td>
                    <td className="min-w-44">
                      <span className="font-medium">{p.name}</span>
                      <span className="block text-xs text-muted">{typeLabel(p)}</span>
                    </td>
                    <td className="text-xs whitespace-nowrap text-muted">{p.sku}</td>
                    <td className="max-w-40">
                      <span className="line-clamp-2">{p.categoryNames.join(", ") || <span className="text-muted">Uncategorised</span>}</span>
                    </td>
                    <td className="tabular-nums"><Price p={p} /></td>
                    <td><Stock p={p} /></td>
                    <td className="whitespace-nowrap">
                      {formatWeight(p.weight)}
                      <span className="block text-xs text-muted">{originCountryName(p.originCountry) ?? "Origin not set"}</span>
                    </td>
                    <td><Status p={p} /></td>
                    <td><ProductRowActions product={p} returnTo={returnTo} /></td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </>
      )}
      <Pagination page={products.page} totalPages={products.totalPages} pathname={PATH} searchParams={params} />
    </>
  );
}

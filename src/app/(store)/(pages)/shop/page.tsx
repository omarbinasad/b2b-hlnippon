import type { Metadata, Route } from "next";
import Link from "next/link";
import { ProductCard, type CardAction } from "@/components/product/product-card";
import { FilterSidebar, type PriceAccess, type ShopFilters, type SidebarCategory } from "@/components/shop/filter-sidebar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Select } from "@/components/ui/field";
import { Icon } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { categoryIcons, defaultCategoryIcon } from "@/config/storefront";
import { canSeeWholesalePrices, getViewer } from "@/lib/auth/session";
import { buildCategoryTree, type CategoryNode } from "@/lib/catalog/category-tree";
import { repositories } from "@/lib/data";
import { stockOptions, stockStatuses } from "@/lib/enums";
import { formatMoney } from "@/lib/format";
import { flatParams, oneOf, param } from "@/lib/list-params";

export const metadata: Metadata = { title: "Shop" };

/** Public sort options (prices are not public, so no price sort). */
const ORDERS = {
  name: { label: "Name A–Z", sort: "name", dir: "asc" },
  "name-desc": { label: "Name Z–A", sort: "name", dir: "desc" },
  newest: { label: "Recently updated", sort: "updated", dir: "desc" },
} as const;
type OrderKey = keyof typeof ORDERS;
const PER_PAGE = 12;

/** Non-negative whole amount, or undefined. */
const amount = (v?: string) => {
  const n = Number(v);
  return v && Number.isFinite(n) && n >= 0 ? Math.min(Math.floor(n), 1e9) : undefined;
};
const findName = (nodes: CategoryNode[], slug?: string): string | undefined => {
  for (const n of nodes) {
    if (n.slug === slug) return n.name;
    const inner = findName(n.children, slug);
    if (inner) return inner;
  }
};

export default async function ShopPage({ searchParams }: PageProps<"/shop">) {
  const sp = await searchParams;
  const viewer = await getViewer();
  const priceAccess: PriceAccess =
    viewer.kind === "admin" ? "admin" : viewer.kind === "customer" ? (canSeeWholesalePrices(viewer) ? "approved" : "pending") : "guest";

  const [categories, brands] = await Promise.all([repositories.products.listCategories(), repositories.products.listBrands()]);

  // Every value is checked against what exists, so a tampered URL only produces a supported query.
  let min = amount(param(sp, "min"));
  let max = amount(param(sp, "max"));
  if (min !== undefined && max !== undefined && min > max) [min, max] = [max, min];
  const filters: ShopFilters = {
    q: param(sp, "q"),
    category: categories.some((c) => c.slug === param(sp, "category")) ? param(sp, "category") : undefined,
    brands: [...new Set((param(sp, "brand") ?? "").split(","))].filter((s) => brands.some((b) => b.slug === s)),
    stock: oneOf(param(sp, "stock"), stockStatuses),
    // The price filter only applies to approved customers (guests must not learn anything about prices).
    min: priceAccess === "approved" ? min : undefined,
    max: priceAccess === "approved" ? max : undefined,
    order: oneOf(param(sp, "order"), Object.keys(ORDERS) as OrderKey[]) ?? "name",
  };
  const order = ORDERS[filters.order as OrderKey];
  const page = Math.max(1, Number(param(sp, "page")) || 1);

  /** Link to the shop with some filters changed (always back to page 1). */
  const href = (change: Partial<ShopFilters>): Route => {
    const f = { ...filters, ...change };
    const qs = new URLSearchParams();
    if (f.q) qs.set("q", f.q);
    if (f.category) qs.set("category", f.category);
    if (f.brands.length) qs.set("brand", f.brands.join(","));
    if (f.stock) qs.set("stock", f.stock);
    if (f.min !== undefined) qs.set("min", String(f.min));
    if (f.max !== undefined) qs.set("max", String(f.max));
    if (f.order !== "name") qs.set("order", f.order);
    const s = qs.toString();
    return (s ? `/shop?${s}` : "/shop") as Route;
  };

  const priced = filters.min !== undefined || filters.max !== undefined;
  const priceIds =
    priced && viewer.kind === "customer" ? await repositories.pricing.productIdsInPriceRange(viewer.customerId, { min: filters.min, max: filters.max }) : undefined;

  const result = await repositories.products.list({
    search: filters.q,
    categorySlug: filters.category,
    brandSlugs: filters.brands.length ? filters.brands : undefined,
    stockStatus: filters.stock,
    productIds: priceIds,
    sort: order.sort,
    dir: order.dir,
    page,
    perPage: PER_PAGE,
  });

  // Customer-specific prices are resolved server-side for the current page only.
  const prices =
    priceAccess === "approved" && viewer.kind === "customer"
      ? await repositories.pricing.getCustomerPrices(viewer.customerId, result.items.map((p) => p.id))
      : [];
  const priceFor = (id: string) => prices.find((p) => p.productId === id)?.unitPrice;

  // The round + on each card. Same rules as the quick order sheet (minimum quantity, stock, price, quantity rules).
  const orderLines =
    priceAccess === "approved" && viewer.kind === "customer" && result.items.length
      ? (await repositories.cart.quickOrder(viewer.customerId, { productIds: result.items.map((p) => p.id) })).lines
      : [];
  const actionFor = (product: (typeof result.items)[number]): CardAction => {
    if (priceAccess === "guest") return { kind: "link", href: "/login", label: "Log in to order" };
    if (priceAccess === "pending") return { kind: "disabled", label: "Available once your account is approved" };
    if (priceAccess === "admin") return { kind: "disabled", label: "Ordering is for approved customers" };
    if (product.hasVariations) return { kind: "link", href: `/shop/${product.slug}`, label: "Choose options" };
    const line = orderLines.find((l) => l.productId === product.id);
    if (!line) return { kind: "disabled", label: "Not available to order" };
    return line.error ? { kind: "disabled", label: line.error } : { kind: "add", quantity: line.minQuantity };
  };

  const tree = buildCategoryTree(categories);
  const sidebarTree: SidebarCategory[] = tree.map((c) => ({ ...c, icon: categoryIcons[c.slug] ?? defaultCategoryIcon }));
  const sidebar = (idPrefix: string) => <FilterSidebar tree={sidebarTree} brands={brands} filters={filters} priceAccess={priceAccess} href={href} idPrefix={idPrefix} />;

  const chips = [
    filters.q && { label: `Search: ${filters.q}`, href: href({ q: undefined }) },
    filters.category && { label: findName(tree, filters.category) ?? filters.category, href: href({ category: undefined }) },
    ...filters.brands.map((slug) => ({ label: brands.find((b) => b.slug === slug)!.name, href: href({ brands: filters.brands.filter((s) => s !== slug) }) })),
    filters.stock && { label: stockOptions.find((o) => o.value === filters.stock)!.label, href: href({ stock: undefined }) },
    priced && {
      label: filters.min !== undefined && filters.max !== undefined ? `${formatMoney(filters.min)} – ${formatMoney(filters.max)}` : filters.min !== undefined ? `From ${formatMoney(filters.min)}` : `Up to ${formatMoney(filters.max!)}`,
      href: href({ min: undefined, max: undefined }),
    },
  ].filter((c): c is { label: string; href: Route } => Boolean(c));
  const activeFilters = chips.length;

  return (
    <>
      <PageHeader title="Shop" description="Browse the wholesale catalog. Prices are shown to approved business customers." />

      <div className="lg:grid lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-6">
        <aside aria-label="Product filters" className="hidden lg:block">{sidebar("desktop")}</aside>

        <div className="min-w-0">
          {/* Phones and tablets: the same filters in a disclosure above the results. */}
          <details className="group/filters mb-4 lg:hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between rounded-ui border border-line bg-surface px-4 py-2.5 text-sm font-semibold [&::-webkit-details-marker]:hidden">
              <span className="flex items-center gap-2">
                <Icon name="menu" className="size-4" />
                Filters{activeFilters > 0 && <span className="rounded-full bg-brand px-2 text-xs text-brand-contrast">{activeFilters}</span>}
              </span>
              <Icon name="chevronDown" className="size-4 text-muted transition-transform group-open/filters:rotate-180" />
            </summary>
            <div className="mt-3">{sidebar("mobile")}</div>
          </details>

          <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
            {/* Searching is done from the header. Sorting keeps the search and the other filters. */}
            <form action="/shop" className="order-last ml-auto flex items-center gap-2">
              {filters.q && <input type="hidden" name="q" value={filters.q} />}
              {filters.category && <input type="hidden" name="category" value={filters.category} />}
              {filters.brands.length > 0 && <input type="hidden" name="brand" value={filters.brands.join(",")} />}
              {filters.stock && <input type="hidden" name="stock" value={filters.stock} />}
              {filters.min !== undefined && <input type="hidden" name="min" value={filters.min} />}
              {filters.max !== undefined && <input type="hidden" name="max" value={filters.max} />}
              <label htmlFor="order" className="sr-only">Sort by</label>
              <Select id="order" name="order" defaultValue={filters.order} className="w-44">
                {Object.entries(ORDERS).map(([key, o]) => (
                  <option key={key} value={key}>{o.label}</option>
                ))}
              </Select>
              <Button type="submit" variant="secondary">Sort</Button>
            </form>
            <p className="mr-1 text-muted" aria-live="polite">
              {result.total} {result.total === 1 ? "product" : "products"}
            </p>
            {chips.map((c) => (
              <Link key={c.label} href={c.href} className="inline-flex items-center gap-1 rounded-full border border-line bg-surface px-3 py-1 text-xs hover:border-brand" aria-label={`Remove filter ${c.label}`}>
                {c.label} <Icon name="close" className="size-3.5" />
              </Link>
            ))}
            {activeFilters > 1 && (
              <Link href={href({ q: undefined, category: undefined, brands: [], stock: undefined, min: undefined, max: undefined })} className="text-xs text-muted underline-offset-4 hover:text-foreground hover:underline">
                Clear all
              </Link>
            )}
          </div>

          {result.items.length === 0 ? (
            <EmptyState
              title="No products found"
              description={priced ? "No products have a price for your account in this range." : "Try a different search term, category, brand or availability."}
            />
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {result.items.map((product) => (
                <li key={product.id}>
                  <ProductCard product={product} price={priceFor(product.id)} access={priceAccess} action={actionFor(product)} />
                </li>
              ))}
            </ul>
          )}

          <Pagination page={result.page} totalPages={result.totalPages} pathname="/shop" searchParams={flatParams(sp)} />
        </div>
      </div>
    </>
  );
}

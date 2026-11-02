import type { Metadata } from "next";
import Link from "next/link";
import { ActionNotice, DemoEditingNotice } from "@/components/admin/demo-notice";
import { ProductImage } from "@/components/product/product-image";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Icon } from "@/components/ui/icons";
import { ListToolbar, SortHeader } from "@/components/ui/list-controls";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { Table } from "@/components/ui/table";
import { repositories } from "@/lib/data";
import type { CategorySortField } from "@/lib/data/repositories";
import { formatNumber } from "@/lib/format";
import { flatParams, listState, oneOf, param } from "@/lib/list-params";

export const metadata: Metadata = { title: "Categories" };

const PATH = "/admin/categories";
const SORTS = ["path", "name", "products"] as const satisfies readonly CategorySortField[];

export default async function CategoriesPage({ searchParams }: PageProps<"/admin/categories">) {
  const sp = await searchParams;
  const state = listState(sp, SORTS, "path");
  const categories = await repositories.categories.list({
    ...state,
    status: oneOf(param(sp, "status"), ["active", "hidden"] as const),
    perPage: 30,
  });
  const params = flatParams(sp);
  const sorting = { sort: state.sort, dir: state.dir, pathname: PATH, params };
  const treeOrder = state.sort === "path" && !state.search;

  return (
    <>
      <PageHeader
        title="Categories"
        description="Organise products into categories and subcategories."
        actions={
          <ButtonLink href="/admin/categories/new">
            <Icon name="plus" className="size-4" /> Add category
          </ButtonLink>
        }
      />
      <div className="mb-4">
        <DemoEditingNotice images />
      </div>
      <ActionNotice notice={param(sp, "notice")} />
      <ListToolbar
        pathname={PATH}
        params={params}
        searchLabel="Search categories"
        searchPlaceholder="Name, slug or description"
        filters={[{ name: "status", label: "Status", options: [{ value: "active", label: "Active" }, { value: "hidden", label: "Hidden" }], allLabel: "All statuses" }]}
        total={categories.total}
        page={categories.page}
        perPage={categories.perPage}
      />
      {categories.items.length === 0 ? (
        <EmptyState title="No categories match" action={<ButtonLink href="/admin/categories/new">Add category</ButtonLink>} />
      ) : (
        <Table caption="Categories" density="compact">
          <thead>
            <tr>
              <th scope="col" className="w-14"><span className="sr-only">Image</span></th>
              <SortHeader label="Category" field="path" {...sorting} />
              <th scope="col">Slug</th>
              <SortHeader label="Products" field="products" defaultDir="desc" className="text-right" {...sorting} />
              <th scope="col">Status</th>
              <th scope="col"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {categories.items.map((c) => (
              <tr key={c.id}>
                <td><ProductImage image={c.image} sizes="40px" className="size-10" /></td>
                <td className="min-w-48">
                  <span className="font-medium" style={treeOrder ? { paddingLeft: `${c.depth * 1.25}rem` } : undefined}>
                    {treeOrder && c.depth > 0 && <span aria-hidden className="mr-1 text-muted">└</span>}
                    {treeOrder ? c.name : c.path}
                  </span>
                  {c.description && <span className="block text-xs text-muted" style={treeOrder ? { paddingLeft: `${c.depth * 1.25}rem` } : undefined}>{c.description}</span>}
                </td>
                <td className="text-muted">{c.slug}</td>
                <td className="text-right tabular-nums">
                  <Link href={`/admin/products?category=${c.slug}`} className="text-brand hover:underline" aria-label={`${c.productCount} products in ${c.name}`}>
                    {formatNumber(c.productCount)}
                  </Link>
                </td>
                <td><Badge tone={c.status === "active" ? "success" : "neutral"}>{c.status === "active" ? "Active" : "Hidden"}</Badge></td>
                <td className="text-right">
                  <Link
                    href={`/admin/categories/${c.id}/edit`}
                    className="inline-flex size-9 items-center justify-center rounded-ui text-muted hover:bg-surface-muted hover:text-foreground"
                    aria-label={`Edit ${c.name}`}
                    title="Edit"
                  >
                    <Icon name="pencil" className="size-4" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <Pagination page={categories.page} totalPages={categories.totalPages} pathname={PATH} searchParams={params} />
    </>
  );
}

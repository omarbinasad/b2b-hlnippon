import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CategoryForm } from "@/components/admin/categories/category-form";
import { CategoryProducts } from "@/components/admin/categories/category-products";
import { Pagination } from "@/components/ui/pagination";
import { repositories } from "@/lib/data";
import { param } from "@/lib/list-params";
import type { Category } from "@/lib/types";

export const metadata: Metadata = { title: "Edit category" };

/** The category and all of its descendants. */
function subtree(all: Category[], id: string): string[] {
  return [id, ...all.filter((c) => c.parentId === id).flatMap((c) => subtree(all, c.id))];
}

export default async function EditCategoryPage({ params, searchParams }: PageProps<"/admin/categories/[id]/edit">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const [category, all, rows, products] = await Promise.all([
    repositories.categories.getById(id),
    repositories.categories.all(),
    repositories.categories.list({ perPage: 48 }),
    repositories.categories.listProducts(id, { page: Number(param(sp, "page")) || 1, perPage: 20 }),
  ]);
  if (!category) notFound();
  const blocked = subtree(all, id);

  return (
    <>
      <CategoryForm
        key={category.id}
        category={category}
        parentOptions={rows.items.filter((c) => !blocked.includes(c.id)).map((c) => ({ id: c.id, path: c.path }))}
        blockedParentIds={blocked}
      />
      <section aria-labelledby="category-products-title" className="mt-8 max-w-3xl rounded-ui border border-line bg-surface p-4 sm:p-5">
        <h2 id="category-products-title" className="text-base font-semibold">Products in this category</h2>
        <p className="mt-0.5 mb-4 text-sm text-muted">Assigning or removing a product applies immediately (demo store) — no need to press Save.</p>
        <CategoryProducts categoryId={category.id} categoryName={category.name} products={products.items} total={products.total} />
        <Pagination page={products.page} totalPages={products.totalPages} pathname={`/admin/categories/${category.id}/edit`} searchParams={{}} />
      </section>
    </>
  );
}

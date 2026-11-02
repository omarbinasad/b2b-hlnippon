import type { Metadata } from "next";
import { CategoryForm } from "@/components/admin/categories/category-form";
import { repositories } from "@/lib/data";

export const metadata: Metadata = { title: "Add category" };

export default async function NewCategoryPage() {
  const categories = await repositories.categories.list({ perPage: 48 });
  return (
    <>
      <CategoryForm parentOptions={categories.items.map((c) => ({ id: c.id, path: c.path }))} blockedParentIds={[]} />
      <p className="mt-4 max-w-3xl text-sm text-muted">
        After creating the category, open it to assign products — or choose categories from each product&apos;s form.
      </p>
    </>
  );
}

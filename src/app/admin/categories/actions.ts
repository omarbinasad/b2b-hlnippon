"use server";

/*
 * Admin category mutations. DEMO: kept in server memory only.
 * TODO(auth): verify the caller is an admin before any mutation.
 */
import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { repositories } from "@/lib/data";
import type { CategoryInput, FieldErrors } from "@/lib/types";

export type SaveCategoryState = { ok: false; errors: FieldErrors; message: string };

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

function toCategoryInput(raw: unknown): CategoryInput {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const img = o.image && typeof o.image === "object" ? (o.image as Record<string, unknown>) : undefined;
  const src = str(img?.src, 2048);
  return {
    name: str(o.name, 200),
    slug: str(o.slug, 200),
    parentId: str(o.parentId, 100) || undefined,
    description: str(o.description, 2000),
    status: o.status === "hidden" ? "hidden" : "active",
    // Local previews (blob:) and data URIs are never stored.
    image:
      src && !src.startsWith("blob:") && !src.startsWith("data:")
        ? { src, alt: str(img?.alt, 200), width: Number(img?.width) || 1200, height: Number(img?.height) || 1200 }
        : undefined,
  };
}

/** Returns field errors, or redirects to the list on success. */
export async function saveCategoryAction(id: string | null, raw: CategoryInput): Promise<SaveCategoryState> {
  const input = toCategoryInput(raw);
  const result = id ? await repositories.categories.update(id, input) : await repositories.categories.create(input);
  if (!result.ok) return { ok: false, errors: result.errors, message: result.message ?? "The category could not be saved." };
  revalidatePath("/admin/categories");
  revalidatePath("/admin/products");
  redirect(`/admin/categories?notice=${id ? "saved" : "created"}` as Route);
}

/** Adds/removes this category on products (immediately, in the demo store). */
export async function assignCategoryProductsAction(
  categoryId: string,
  change: { add?: string[]; remove?: string[] },
): Promise<{ ok: boolean; message: string }> {
  const clean = (v: unknown) => (Array.isArray(v) ? v.slice(0, 50).filter((x): x is string => typeof x === "string") : []);
  const result = await repositories.categories.assignProducts(str(categoryId, 100), { add: clean(change?.add), remove: clean(change?.remove) });
  if (!result.ok) return { ok: false, message: result.message ?? "Could not update the category." };
  revalidatePath("/admin/categories");
  revalidatePath("/admin/products");
  return { ok: true, message: result.value ? "Updated." : "No change." };
}

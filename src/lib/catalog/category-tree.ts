import type { Category } from "@/lib/types";

/** Serializable navigation node (safe to pass to client components). */
export interface CategoryNode {
  name: string;
  slug: string;
  children: CategoryNode[];
}

/**
 * Builds the navigation tree from a list of (public) categories, at any depth, sorted by
 * name at every level. A category whose parent is not in the list (e.g. a hidden parent)
 * is left out together with its subtree, so hidden branches never leak into navigation.
 */
export function buildCategoryTree(categories: Pick<Category, "id" | "name" | "slug" | "parentId">[]): CategoryNode[] {
  const ids = new Set(categories.map((c) => c.id));
  const byParent = new Map<string | undefined, typeof categories>();
  for (const c of categories) {
    const key = c.parentId && ids.has(c.parentId) ? c.parentId : c.parentId ? "__orphan__" : undefined;
    byParent.set(key, [...(byParent.get(key) ?? []), c]);
  }
  const build = (parent: string | undefined, seen: Set<string>): CategoryNode[] =>
    (byParent.get(parent) ?? [])
      .filter((c) => !seen.has(c.id))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((c) => ({ name: c.name, slug: c.slug, children: build(c.id, new Set(seen).add(c.id)) }));
  return build(undefined, new Set());
}

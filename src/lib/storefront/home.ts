import "server-only";

import { homeContent } from "@/config/storefront";
import { repositories } from "@/lib/data";
import type { Category } from "@/lib/types";

/**
 * Top-level categories featured on Home: the configured slugs in order (active ones only),
 * filled up to `max` with other top-level categories that have an image (by name).
 */
export async function getHomeCategories(): Promise<Category[]> {
  const { slugs, max } = homeContent.featuredCategories;
  const roots = (await repositories.products.listCategories()).filter((c) => !c.parentId);
  const picked = slugs.flatMap((slug) => roots.filter((c) => c.slug === slug));
  const fill = roots.filter((c) => c.image && !picked.includes(c)).sort((a, b) => a.name.localeCompare(b.name));
  return [...picked, ...fill].slice(0, max);
}

import "server-only";

import type { FormOptions } from "@/components/admin/products/draft";
import { repositories } from "@/lib/data";
import { allPages } from "@/lib/data/all-pages";

/** Choices for the product form's selectors, loaded on the server. */
export async function loadProductFormOptions(): Promise<FormOptions> {
  const { categories, catalogSettings, settings } = repositories;
  const [cats, brands, tags, attributes, shippingClasses, taxClasses, defaults, store] = await Promise.all([
    allPages((page, perPage) => categories.list({ page, perPage })),
    catalogSettings.brands(),
    catalogSettings.tags(),
    catalogSettings.attributes(),
    catalogSettings.shippingClasses(),
    catalogSettings.taxClasses(),
    catalogSettings.storeDefaults(),
    settings.getStore(),
  ]);
  return {
    categories: cats,
    brands,
    tags,
    attributes,
    shippingClasses,
    taxClasses,
    lowStockThreshold: defaults.lowStockThreshold,
    units: { weight: store.weightUnit, dimension: store.dimensionUnit },
  };
}

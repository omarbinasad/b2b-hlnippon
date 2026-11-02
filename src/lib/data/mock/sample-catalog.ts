import type { Brand, Category, Product, Tag } from "@/lib/types";
import fixture from "../fixtures/sample-catalog.json";

/**
 * Standalone sample catalog (fictional demo data with local images in /public/images): categories,
 * brands, tags and ~60 products with sample JPY wholesale prices. Not linked to any external store —
 * the app, builds and tests never contact another system. Ids are stable ("sp-…", "scat-…").
 */
interface SampleCatalog {
  meta: { source: "sample"; note: string; currency: string; weightUnit: string; dimensionUnit: string };
  categories: Category[];
  brands: Brand[];
  tags: Tag[];
  products: Product[];
}

const sample = fixture as unknown as SampleCatalog;

export const sampleCatalogMeta = sample.meta;
export const sampleCategories = sample.categories;
export const sampleBrands = sample.brands;
export const sampleTags = sample.tags;
export const sampleProducts = sample.products;

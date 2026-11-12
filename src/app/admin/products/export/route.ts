import { getCapabilities } from "@/lib/auth/session";
import { PRODUCT_CSV_FIELDS, toCsvText } from "@/lib/catalog/csv";
import { allPages } from "@/lib/data/all-pages";
import { repositories } from "@/lib/data";
import { productStatuses, stockStatuses } from "@/lib/enums";
import type { Product, ProductCsvField } from "@/lib/types";

const oneOf = <T extends string>(v: string | null, allowed: readonly T[]) => (allowed.includes(v as T) ? (v as T) : undefined);
const yesNo = (b: boolean) => (b ? "yes" : "no");

/** A product and its options as CSV rows: the same columns the importer reads. */
function productRows(p: Product, categoryName: (id: string) => string): Partial<Record<ProductCsvField, string | number | undefined>>[] {
  const attr = p.attributes.find((a) => a.variation);
  const head: Partial<Record<ProductCsvField, string | number | undefined>> = {
    id: p.id, type: p.type, sku: p.sku, name: p.name, status: p.status === "archived" ? "draft" : p.status, categories: p.categoryIds.map(categoryName).join(", "),
    regularPrice: p.basePrice, salePrice: p.salePrice, manageStock: yesNo(p.manageStock), stock: p.manageStock ? p.stock.quantity : undefined,
    stockStatus: p.manageStock ? undefined : p.stock.status, weight: p.weight.value, weightUnit: p.weight.unit, unitLabel: p.unitLabel,
    minQuantity: p.quantityRule.min, maxQuantity: p.quantityRule.max, quantityStep: p.quantityRule.step, pricedByWeight: yesNo(p.isVariableWeight),
    taxClass: p.taxClass, shortDescription: p.shortDescription, description: p.description, attributeName: attr?.name, attributeValues: attr?.values.join("|"),
  };
  const options = p.type === "variable" ? p.variations.map((v) => ({
    id: v.id, type: "variation", sku: v.sku, parentSku: p.sku, name: `${p.name} - ${Object.values(v.attributes).join(" ")}`, status: v.status === "active" ? "published" : "draft",
    regularPrice: v.basePrice, salePrice: v.salePrice, stock: v.stockMode === "track" ? v.stock.quantity : undefined, stockStatus: v.stockMode === "status" ? v.stock.status : undefined,
    weight: v.weight?.value, weightUnit: v.weight?.unit, attributeName: attr?.name, attributeValues: attr ? v.attributes[attr.name] : undefined,
  })) : [];
  return [head, ...options];
}

/**
 * DEMO product CSV: the products matching the list's filters, or the ids given, in the chosen columns (\`cols\`), or an
 * empty template with example rows (\`template=1\`). Mock permission; the backend must authorize and generate real exports.
 */
export async function GET(request: Request) {
  if (!(await getCapabilities()).includes("products.export")) return new Response("Your role can't export products.", { status: 403 });
  const sp = new URL(request.url).searchParams;
  const keys = PRODUCT_CSV_FIELDS.map((f) => f.key);
  const wanted = (sp.get("cols") ?? "").split(",").filter((k): k is ProductCsvField => keys.includes(k as ProductCsvField));
  const columns = PRODUCT_CSV_FIELDS.filter((f) => !wanted.length || wanted.includes(f.key));
  const header = columns.map((f) => f.label);
  const file = (name: string, rows: (string | number | undefined)[][]) =>
    new Response(`﻿${toCsvText([header, ...rows])}`, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "private, no-store" } });

  if (sp.get("template") === "1") {
    const examples: Partial<Record<ProductCsvField, string>>[] = [
      { type: "simple", sku: "RICE-5KG", name: "Basmati rice 5 kg bag", status: "draft", categories: "Rice", regularPrice: "1200", manageStock: "yes", stock: "40", weight: "5", weightUnit: "kg", unitLabel: "bag", minQuantity: "1", quantityStep: "1", pricedByWeight: "no", taxClass: "standard" },
      { type: "variable", sku: "OIL", name: "Cooking oil", status: "draft", categories: "Oil", manageStock: "no", stockStatus: "in_stock", weight: "5", unitLabel: "container", attributeName: "Size", attributeValues: "5 L|18 L" },
      { type: "variation", sku: "OIL-5L", parentSku: "OIL", regularPrice: "1500", attributeValues: "5 L", weight: "5" },
      { type: "variation", sku: "OIL-18L", parentSku: "OIL", regularPrice: "4800", attributeValues: "18 L", weight: "18" },
    ];
    return file("products-template.csv", examples.map((e) => columns.map((c) => e[c.key])));
  }

  const ids = (sp.get("ids") ?? "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 500);
  const rows = ids.length
    ? ids.map((id) => ({ id }))
    : await allPages((page, perPage) =>
        repositories.products.adminList({
          search: sp.get("q") ?? undefined,
          categorySlug: sp.get("category") ?? undefined,
          type: oneOf(sp.get("type"), ["simple", "variable"] as const),
          stockStatus: oneOf(sp.get("stock"), stockStatuses),
          status: oneOf(sp.get("status"), productStatuses),
          pricing: oneOf(sp.get("pricing"), ["missing", "set"] as const),
          page,
          perPage,
        }),
      );
  const [products, categories] = await Promise.all([
    Promise.all(rows.map((r) => repositories.products.getById(r.id))),
    allPages((page, perPage) => repositories.categories.list({ page, perPage })),
  ]);
  const name = (id: string) => categories.find((c) => c.id === id)?.name ?? id;
  const lines = products.filter((p): p is Product => Boolean(p)).flatMap((p) => productRows(p, name)).map((r) => columns.map((c) => r[c.key]));
  return file(ids.length ? "products-selected.csv" : "products.csv", lines);
}

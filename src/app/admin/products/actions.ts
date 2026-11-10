"use server";

/*
 * Admin product mutations and lookups. DEMO: the mock repository keeps changes
 * in server memory only. TODO(auth): verify the caller is an admin before any
 * mutation — today these actions are as open as the rest of the preview admin.
 */
import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { actorWith, getAdminActor } from "@/lib/auth/session";
import { repositories } from "@/lib/data";
import { productStatuses } from "@/lib/enums";
import type { AttributeValue, Brand, Category, Dimensions, FieldErrors, ProductInput, ProductPick, ProductStatus, VariationInput } from "@/lib/types";
import { slugify } from "@/lib/validation/product";

export type SaveProductState =
  | { ok: true; savedAt: string }
  | { ok: false; errors: FieldErrors; message: string };

// --- Coercion of untrusted action arguments ---------------------------------------

const str = (v: unknown, max = 10_000) => (typeof v === "string" ? v.slice(0, max) : "");
const optStr = (v: unknown, max = 10_000) => str(v, max).trim() || undefined;
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const oneOf = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(v as T) ? (v as T) : fallback;
const optOneOf = <T extends string>(v: unknown, allowed: readonly T[]): T | undefined =>
  allowed.includes(v as T) ? (v as T) : undefined;
const arr = (v: unknown, max = 200): unknown[] => (Array.isArray(v) ? v.slice(0, max) : []);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
const ids = (v: unknown) => arr(v, 50).map((x) => str(x, 100)).filter(Boolean);
const date = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);
const record = (v: unknown) =>
  Object.fromEntries(Object.entries(obj(v)).slice(0, 20).map(([k, val]) => [str(k, 100), str(val, 100)]));

const STOCK = ["in_stock", "low_stock", "out_of_stock", "backorder"] as const;
const BACKORDERS = ["no", "notify", "allow"] as const;
const TAX_CLASSES = ["standard", "reduced", "exempt"] as const;

function image(v: unknown) {
  const o = obj(v);
  const src = str(o.src, 2048);
  // Only server-side paths/URLs; local previews (blob:) and data URIs are never stored.
  if (!src || src.startsWith("blob:") || src.startsWith("data:")) return undefined;
  return { src, alt: str(o.alt, 200), width: num(o.width) ?? 1200, height: num(o.height) ?? 1200 };
}
const images = (v: unknown) => arr(v, 20).map(image).filter((i) => i !== undefined);

function weight(v: unknown) {
  const o = obj(v);
  return { value: num(o.value) ?? Number.NaN, unit: oneOf(o.unit, ["g", "kg"] as const, "kg") };
}

function dimensions(v: unknown): Dimensions | undefined {
  if (!v) return undefined;
  const o = obj(v);
  return {
    length: num(o.length) ?? Number.NaN,
    width: num(o.width) ?? Number.NaN,
    height: num(o.height) ?? Number.NaN,
    unit: oneOf(o.unit, ["cm", "mm", "m"] as const, "cm"),
  };
}

function variation(v: unknown): VariationInput {
  const x = obj(v);
  return {
    id: optStr(x.id, 100),
    sku: str(x.sku, 200),
    gtin: optStr(x.gtin, 20),
    attributes: record(x.attributes),
    status: oneOf(x.status, ["active", "disabled"] as const, "active"),
    basePrice: num(x.basePrice),
    salePrice: num(x.salePrice),
    saleFrom: date(x.saleFrom),
    saleTo: date(x.saleTo),
    image: image(x.image),
    gallery: images(x.gallery),
    description: optStr(x.description, 2000),
    stockMode: oneOf(x.stockMode, ["parent", "track", "status"] as const, "track"),
    stockQuantity: num(x.stockQuantity),
    stockStatus: oneOf(x.stockStatus, STOCK, "in_stock"),
    backorders: optOneOf(x.backorders, BACKORDERS),
    weight: x.weight ? weight(x.weight) : undefined,
    dimensions: dimensions(x.dimensions),
    shippingClassId: optStr(x.shippingClassId, 100),
    taxClass: optOneOf(x.taxClass, TAX_CLASSES),
  };
}

/** Rebuilds a well-formed ProductInput from untrusted action arguments. */
function toProductInput(raw: unknown): ProductInput {
  const o = obj(raw);
  return {
    type: oneOf(o.type, ["simple", "variable"] as const, "simple"),
    name: str(o.name, 500),
    slug: str(o.slug, 500),
    sku: str(o.sku, 200),
    gtin: optStr(o.gtin, 20),
    shortDescription: str(o.shortDescription, 2000),
    description: str(o.description, 20_000),
    status: oneOf(o.status, productStatuses, "draft"),
    visibility: oneOf(o.visibility, ["visible", "catalog", "search", "hidden"] as const, "visible"),
    featured: o.featured === true,
    categoryIds: ids(o.categoryIds),
    tags: arr(o.tags, 50).map((t) => str(t, 100)).filter(Boolean),
    brandIds: ids(o.brandIds),
    images: images(o.images),
    originCountry: optStr(o.originCountry, 2),
    unitLabel: str(o.unitLabel, 100),
    basePrice: num(o.basePrice),
    salePrice: num(o.salePrice),
    saleFrom: date(o.saleFrom),
    saleTo: date(o.saleTo),
    taxStatus: oneOf(o.taxStatus, ["taxable", "shipping", "none"] as const, "taxable"),
    taxClass: oneOf(o.taxClass, TAX_CLASSES, "standard"),
    manageStock: o.manageStock === true,
    stockQuantity: num(o.stockQuantity),
    stockStatus: oneOf(o.stockStatus, STOCK, "in_stock"),
    backorders: oneOf(o.backorders, BACKORDERS, "no"),
    lowStockThreshold: num(o.lowStockThreshold),
    soldIndividually: o.soldIndividually === true,
    initialStock: num(o.initialStock),
    unitOfMeasure: optStr(o.unitOfMeasure, 50),
    weight: weight(o.weight),
    dimensions: dimensions(o.dimensions),
    shippingClassId: optStr(o.shippingClassId, 100),
    isVariableWeight: o.isVariableWeight === true,
    attributes: arr(o.attributes, 20).map((a) => {
      const x = obj(a);
      return {
        attributeId: optStr(x.attributeId, 100),
        name: str(x.name, 100),
        values: arr(x.values, 100).map((val) => str(val, 100)),
        visible: x.visible === true,
        variation: x.variation === true,
      };
    }),
    defaultAttributes: record(o.defaultAttributes),
    variations: arr(o.variations, 150).map(variation),
    upsellIds: ids(o.upsellIds),
    crossSellIds: ids(o.crossSellIds),
    purchaseNote: optStr(o.purchaseNote, 2000),
    menuOrder: num(o.menuOrder) ?? Number.NaN,
    reviewsEnabled: o.reviewsEnabled === true,
  };
}

// --- Actions ------------------------------------------------------------------------

export async function saveProductAction(id: string | null, raw: ProductInput): Promise<SaveProductState> {
  if (!(await actorWith(id ? "products.edit" : "products.create"))) return { ok: false, errors: {}, message: "You don't have permission to do this." };
  const input = toProductInput(raw);
  const result = id ? await repositories.products.update(id, input, (await getAdminActor()).name) : await repositories.products.create(input);
  if (!result.ok) return { ok: false, errors: result.errors, message: result.message ?? "The product could not be saved." };

  revalidatePath("/admin/products");
  if (!id) redirect(`/admin/products/${result.value.id}/edit?notice=created` as Route);
  return { ok: true, savedAt: result.value.updatedAt };
}

/** Product search for pickers (linked products, category assignment). Returns at most 10 matches. */
export async function searchProductsAction(term: string, excludeIds: string[] = []): Promise<ProductPick[]> {
  return repositories.products.search(str(term, 100), { excludeIds: ids(excludeIds), limit: 10 });
}

/** Only allow returning to admin product URLs. */
const safeReturn = (v: FormDataEntryValue | null) => {
  const s = typeof v === "string" ? v : "";
  return s.startsWith("/admin/products") && !s.startsWith("//") ? s : "/admin/products";
};

const withNotice = (url: string, notice: string) => `${url}${url.includes("?") ? "&" : "?"}notice=${notice}`;

export async function duplicateProductAction(formData: FormData) {
  if (!(await actorWith("products.create"))) redirect(withNotice(safeReturn(formData.get("returnTo")), "error") as Route);
  const result = await repositories.products.duplicate(String(formData.get("id") ?? ""));
  if (!result.ok) redirect(withNotice(safeReturn(formData.get("returnTo")), "error") as Route);
  revalidatePath("/admin/products");
  redirect(`/admin/products/${result.value.id}/edit?notice=duplicated` as Route);
}

export async function setProductStatusAction(formData: FormData) {
  const status = oneOf<ProductStatus>(formData.get("status"), productStatuses, "draft");
  // Archiving hides a product from the store, so it counts as removing it; restoring is an edit.
  if (!(await actorWith(status === "archived" ? "products.delete" : "products.edit"))) redirect(withNotice(safeReturn(formData.get("returnTo")), "error") as Route);
  const result = await repositories.products.setStatus(String(formData.get("id") ?? ""), status);
  revalidatePath("/admin/products");
  const returnTo = safeReturn(formData.get("returnTo")).replace(/([?&])notice=[^&]*&?/, "$1").replace(/[?&]$/, "");
  redirect(withNotice(returnTo, result.ok ? (status === "archived" ? "archived" : "restored") : "error") as Route);
}

// --- Inline creation from the product form (demo store) ----------------------------

type Created<T> = { ok: true; value: T } | { ok: false; error: string };
const noPermission = { ok: false as const, error: "You don't have permission to do this." };
/** These run from the product form, on a new product as well as an existing one. */
const canEditCatalog = async () => Boolean((await actorWith("products.edit")) ?? (await actorWith("products.create")));
const firstError = (errors: FieldErrors, message?: string) => Object.values(errors)[0] ?? message ?? "Could not be created.";

export async function createBrandAction(name: string): Promise<Created<Brand>> {
  if (!(await canEditCatalog())) return noPermission;
  const result = await repositories.catalogSettings.createBrand(str(name, 100));
  return result.ok ? result : { ok: false, error: firstError(result.errors, result.message) };
}

/** Adds a reusable value to a store-wide attribute (available to every product). */
export async function createAttributeValueAction(attributeId: string, name: string): Promise<Created<AttributeValue>> {
  if (!(await canEditCatalog())) return noPermission;
  const result = await repositories.catalogSettings.createAttributeValue(str(attributeId, 100), str(name, 100));
  return result.ok ? result : { ok: false, error: firstError(result.errors, result.message) };
}

export async function quickCreateCategoryAction(name: string, parentId?: string): Promise<Created<Category>> {
  if (!(await canEditCatalog())) return noPermission;
  const clean = str(name, 100).trim();
  const result = await repositories.categories.create({
    name: clean,
    slug: slugify(clean),
    parentId: optStr(parentId, 100),
    status: "active",
  });
  if (!result.ok) return { ok: false, error: firstError(result.errors, result.message) };
  revalidatePath("/admin/categories");
  return result;
}

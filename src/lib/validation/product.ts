/**
 * Product and category input validation, shared by the admin forms (instant
 * field errors) and the mock repository (simulated server-side 422). The real
 * backend must enforce the same rules plus uniqueness checks.
 */
import type { CategoryInput, Dimensions, FieldErrors, ProductInput } from "@/lib/types";
import { amountRule, isValidAmount } from "../orders/calc.ts";

export const LIMITS = {
  name: 120,
  slug: 120,
  sku: 64,
  shortDescription: 300,
  description: 10_000,
  variationDescription: 500,
  purchaseNote: 1000,
  categoryName: 80,
  tag: 40,
  tags: 20,
  linked: 20,
  /** Upper bound on variations, to keep the editor usable. */
  variations: 100,
  /** Ask for confirmation before generating more than this many variations at once. */
  confirmGenerate: 30,
} as const;

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SKU = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
/** GTIN-8, UPC-A (12), EAN-13 or GTIN-14. */
const GTIN = /^(\d{8}|\d{12,14})$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** "Premium Basmati Rice (5 kg)" → "premium-basmati-rice-5-kg" */
export function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, LIMITS.slug);
}

/** ≥ 0 with at most the currency's decimals (whole yen for JPY). */
const isMoney = isValidAmount;
const isCount = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 0;

function checkText(errors: FieldErrors, key: string, value: string | undefined, label: string, max: number, required = true) {
  const v = (value ?? "").trim();
  if (required && !v) errors[key] = `${label} is required.`;
  else if (v.length > max) errors[key] = `${label} must be ${max} characters or fewer.`;
}

function checkSku(errors: FieldErrors, key: string, value: string) {
  if (!value.trim()) errors[key] = "SKU is required.";
  else if (!SKU.test(value) || value.length > LIMITS.sku) errors[key] = "Use letters, numbers, dots, hyphens or underscores.";
}

function checkGtin(errors: FieldErrors, key: string, value?: string) {
  if (value && !GTIN.test(value)) errors[key] = "Enter 8, 12, 13 or 14 digits (GTIN / EAN / UPC).";
}

/** Prices plus optional sale schedule. `prefix` is "" or "variations.N.". */
function checkPricing(
  errors: FieldErrors,
  prefix: string,
  p: { basePrice?: number; salePrice?: number; saleFrom?: string; saleTo?: string },
  priceRequired: boolean,
) {
  if (p.basePrice === undefined) {
    if (priceRequired) errors[`${prefix}basePrice`] = "Enter a price.";
  } else if (!isMoney(p.basePrice)) {
    errors[`${prefix}basePrice`] = `Enter a valid amount (0 or more, ${amountRule()}).`;
  }
  if (p.salePrice !== undefined) {
    if (!isMoney(p.salePrice)) errors[`${prefix}salePrice`] = `Enter a valid amount (0 or more, ${amountRule()}).`;
    else if (p.basePrice === undefined || (isMoney(p.basePrice) && p.salePrice >= p.basePrice))
      errors[`${prefix}salePrice`] = "Sale price must be lower than the regular price.";
  }
  if (p.saleFrom && !DATE.test(p.saleFrom)) errors[`${prefix}saleFrom`] = "Choose a valid date.";
  if (p.saleTo && !DATE.test(p.saleTo)) errors[`${prefix}saleTo`] = "Choose a valid date.";
  if ((p.saleFrom || p.saleTo) && p.salePrice === undefined) errors[`${prefix}salePrice`] = "Enter a sale price for the scheduled sale.";
  if (p.saleFrom && p.saleTo && p.saleTo < p.saleFrom) errors[`${prefix}saleTo`] = "The sale must end on or after its start date.";
}

function checkWeight(errors: FieldErrors, key: string, value: number) {
  if (!(Number.isFinite(value) && value > 0)) errors[key] = "Enter a weight greater than 0.";
}

function checkDimensions(errors: FieldErrors, key: string, d?: Dimensions) {
  if (!d) return;
  if (![d.length, d.width, d.height].every((n) => Number.isFinite(n) && n > 0)) {
    errors[key] = "Enter length, width and height greater than 0 — or leave all three empty.";
  }
}

function checkOptionalCount(errors: FieldErrors, key: string, value: number | undefined, label: string) {
  if (value !== undefined && !isCount(value)) errors[key] = `${label} must be a whole number of 0 or more.`;
}

/** Returns field errors; an empty object means valid. */
export function validateProduct(input: ProductInput, selfId?: string): FieldErrors {
  const errors: FieldErrors = {};
  const publishing = input.status === "published";

  checkText(errors, "name", input.name, "Name", LIMITS.name);
  if (!input.slug.trim()) errors.slug = "Slug is required.";
  else if (!SLUG.test(input.slug)) errors.slug = "Use lowercase letters, numbers and single hyphens (e.g. basmati-rice-5kg).";
  checkSku(errors, "sku", input.sku);
  checkGtin(errors, "gtin", input.gtin);
  checkText(errors, "shortDescription", input.shortDescription, "Short description", LIMITS.shortDescription, false);
  checkText(errors, "description", input.description, "Description", LIMITS.description, false);
  checkText(errors, "unitLabel", input.unitLabel, "Selling unit", 30);
  checkText(errors, "purchaseNote", input.purchaseNote, "Purchase note", LIMITS.purchaseNote, false);
  if (publishing && input.categoryIds.length === 0) errors.categoryIds = "Choose at least one category before publishing.";
  if (input.tags.length > LIMITS.tags) errors.tags = `Use at most ${LIMITS.tags} tags.`;
  else if (input.tags.some((t) => t.trim().length > LIMITS.tag)) errors.tags = `Each tag must be ${LIMITS.tag} characters or fewer.`;
  if (!Number.isInteger(input.menuOrder)) errors.menuOrder = "Display order must be a whole number.";

  checkWeight(errors, "weight", input.weight.value);
  checkDimensions(errors, "dimensions", input.dimensions);
  checkOptionalCount(errors, "lowStockThreshold", input.lowStockThreshold, "Low-stock threshold");
  checkOptionalCount(errors, "initialStock", input.initialStock, "Initial stock");
  if (input.manageStock && !isCount(input.stockQuantity)) errors.stockQuantity = "Enter a whole number of 0 or more.";

  input.images.forEach((img, i) => {
    if (!img.alt.trim()) errors[`images.${i}.alt`] = "Describe the image for screen readers.";
  });
  for (const key of ["upsellIds", "crossSellIds"] as const) {
    if (selfId && input[key].includes(selfId)) errors[key] = "A product can't be linked to itself.";
    else if (input[key].length > LIMITS.linked) errors[key] = `Link at most ${LIMITS.linked} products.`;
  }

  // Attributes (both types; simple products use them for information only)
  const names = new Set<string>();
  input.attributes.forEach((a, i) => {
    const name = a.name.trim();
    if (!name) errors[`attributes.${i}.name`] = "Attribute name is required.";
    else if (names.has(name.toLowerCase())) errors[`attributes.${i}.name`] = "This attribute is already on the product.";
    names.add(name.toLowerCase());
    if (a.values.length === 0) errors[`attributes.${i}.values`] = "Add at least one value.";
    else if (new Set(a.values.map((v) => v.toLowerCase())).size !== a.values.length) errors[`attributes.${i}.values`] = "Values must be unique.";
  });

  if (input.type === "simple") {
    checkPricing(errors, "", input, publishing);
    return errors;
  }

  // Variable product
  const variationAttrs = input.attributes.filter((a) => a.variation);
  if (variationAttrs.length === 0) errors.attributes = "Mark at least one attribute as “Used for variations” (e.g. Size).";
  if (input.variations.length === 0) errors.variations = "Add or generate at least one variation.";
  if (input.variations.length > LIMITS.variations) errors.variations = `A product can have at most ${LIMITS.variations} variations.`;

  for (const [name, value] of Object.entries(input.defaultAttributes)) {
    const attr = variationAttrs.find((a) => a.name === name);
    if (value && (!attr || !attr.values.includes(value))) errors[`defaultAttributes.${name}`] = "Choose one of the attribute's values.";
  }

  const skus = new Set<string>([input.sku.trim().toLowerCase()]);
  const combos = new Set<string>();
  input.variations.forEach((v, i) => {
    const p = `variations.${i}.`;
    checkSku(errors, `${p}sku`, v.sku);
    if (!errors[`${p}sku`] && skus.has(v.sku.trim().toLowerCase())) errors[`${p}sku`] = "SKU must be unique within the product.";
    skus.add(v.sku.trim().toLowerCase());
    checkGtin(errors, `${p}gtin`, v.gtin);

    const missing = variationAttrs.filter((a) => !a.values.includes(v.attributes[a.name] ?? ""));
    const combo = variationAttrs.map((a) => v.attributes[a.name]).join("|");
    if (missing.length) errors[`${p}attributes`] = `Choose a value for ${missing.map((a) => a.name).join(", ")}.`;
    else if (combos.has(combo)) errors[`${p}attributes`] = "Another variation already uses this combination.";
    combos.add(combo);

    checkPricing(errors, p, v, publishing && v.status === "active");
    if (v.stockMode === "track" && !isCount(v.stockQuantity)) errors[`${p}stockQuantity`] = "Enter a whole number of 0 or more.";
    if (v.stockMode === "parent" && !input.manageStock)
      errors[`${p}stockMode`] = "The product doesn't track stock. Turn on “Track stock” in Inventory, or choose another option.";
    if (v.weight) checkWeight(errors, `${p}weight`, v.weight.value);
    checkDimensions(errors, `${p}dimensions`, v.dimensions);
    if (v.image && !v.image.alt.trim()) errors[`${p}image.0.alt`] = "Describe the image for screen readers.";
    checkText(errors, `${p}description`, v.description, "Description", LIMITS.variationDescription, false);
  });
  return errors;
}

/** Enabled variations without a regular price — they cannot be purchased. */
export const unpricedVariationIndexes = (input: Pick<ProductInput, "type" | "variations">) =>
  input.type === "variable"
    ? input.variations.flatMap((v, i) => (v.status === "active" && v.basePrice === undefined ? [i] : []))
    : [];

/** `selfAndDescendantIds` = the category's own subtree (cannot be chosen as its parent). */
export function validateCategory(input: CategoryInput, selfAndDescendantIds: string[] = []): FieldErrors {
  const errors: FieldErrors = {};
  checkText(errors, "name", input.name, "Name", LIMITS.categoryName);
  if (!input.slug.trim()) errors.slug = "Slug is required.";
  else if (!SLUG.test(input.slug)) errors.slug = "Use lowercase letters, numbers and single hyphens.";
  if (input.parentId && selfAndDescendantIds.includes(input.parentId)) errors.parentId = "A category can't be placed inside itself or its subcategories.";
  checkText(errors, "description", input.description, "Description", 1000, false);
  if (input.image && !input.image.alt.trim()) errors["image.alt"] = "Describe the image for screen readers.";
  return errors;
}

/** Cartesian product of the variation attributes, e.g. Size × Pack → [{Size, Pack}, …]. */
export function attributeCombinations(attributes: { name: string; values: string[] }[]): Record<string, string>[] {
  if (attributes.length === 0) return [];
  return attributes.reduce<Record<string, string>[]>(
    (combos, attr) => combos.flatMap((c) => attr.values.map((v) => ({ ...c, [attr.name]: v }))),
    [{}],
  );
}

/**
 * Editable form state for the product form. Inputs are kept as strings while
 * typing and converted to a typed `ProductInput` for validation and saving.
 * Variation overrides are explicit: "" / false means "same as the product".
 */
import type {
  AdminCategoryRow,
  Attribute,
  BackorderPolicy,
  Brand,
  DimensionUnit,
  Dimensions,
  FieldErrors,
  Product,
  ProductInput,
  ProductPick,
  ProductStatus,
  ProductType,
  ProductVisibility,
  ShippingClass,
  StockStatus,
  Tag,
  TaxClass,
  TaxClassOption,
  TaxStatus,
  VariationStatus,
  VariationStockMode,
  WeightUnit,
} from "@/lib/types";
import { slugify } from "@/lib/validation/product";

export interface ImageDraft {
  key: string;
  src: string;
  alt: string;
  width: number;
  height: number;
  /** Chosen from this computer: previewed via an object URL, never uploaded. */
  local: boolean;
}

export interface AttributeDraft {
  key: string;
  /** Store-wide attribute; omitted for product-specific ones. */
  attributeId?: string;
  name: string;
  values: string[];
  visible: boolean;
  variation: boolean;
}

export interface DimensionsDraft {
  length: string;
  width: string;
  height: string;
  unit: DimensionUnit;
}

export interface VariationDraft {
  key: string;
  id?: string;
  legacyWooId?: number;
  sku: string;
  gtin: string;
  attributes: Record<string, string>;
  status: VariationStatus;
  basePrice: string;
  salePrice: string;
  saleScheduled: boolean;
  saleFrom: string;
  saleTo: string;
  /** Gallery image key for the main variation image ("" = product main image). */
  imageKey: string;
  /** Image uploaded for this variation only (0 or 1 item); overrides `imageKey`. */
  ownImage: ImageDraft[];
  /** Extra gallery image keys for this variation. */
  galleryKeys: string[];
  description: string;
  stockMode: VariationStockMode;
  stockQuantity: string;
  stockStatus: StockStatus;
  /** "" = same as product. */
  backorders: BackorderPolicy | "";
  overrideWeight: boolean;
  weightValue: string;
  weightUnit: WeightUnit;
  overrideDimensions: boolean;
  dims: DimensionsDraft;
  /** "" = same as product. */
  shippingClassId: string;
  /** "" = same as product. */
  taxClass: TaxClass | "";
}

export interface ProductDraft {
  legacyWooId?: number;
  type: ProductType;
  name: string;
  slug: string;
  /** Once the slug is edited by hand it stops following the name. */
  slugEdited: boolean;
  sku: string;
  gtin: string;
  shortDescription: string;
  description: string;
  status: ProductStatus;
  visibility: ProductVisibility;
  featured: boolean;
  categoryIds: string[];
  tags: string[];
  brandIds: string[];
  images: ImageDraft[];
  originCountry: string;
  unitLabel: string;
  basePrice: string;
  salePrice: string;
  saleScheduled: boolean;
  saleFrom: string;
  saleTo: string;
  taxStatus: TaxStatus;
  taxClass: TaxClass;
  manageStock: boolean;
  stockQuantity: string;
  stockStatus: StockStatus;
  backorders: BackorderPolicy;
  lowStockThreshold: string;
  soldIndividually: boolean;
  initialStock: string;
  unitOfMeasure: string;
  weightValue: string;
  weightUnit: WeightUnit;
  dims: DimensionsDraft;
  shippingClassId: string;
  isVariableWeight: boolean;
  attributes: AttributeDraft[];
  defaultAttributes: Record<string, string>;
  variations: VariationDraft[];
  upsells: ProductPick[];
  crossSells: ProductPick[];
  purchaseNote: string;
  menuOrder: string;
  reviewsEnabled: boolean;
}

/** Choices loaded on the server for the form's selectors. */
export interface FormOptions {
  categories: AdminCategoryRow[];
  brands: Brand[];
  tags: Tag[];
  attributes: Attribute[];
  shippingClasses: ShippingClass[];
  taxClasses: TaxClassOption[];
  /** Store-wide low-stock threshold (placeholder for the product field). */
  lowStockThreshold: number;
  /** Store default units for new products (Settings → Store). */
  units: { weight: WeightUnit; dimension: DimensionUnit };
}

/** Props shared by the form's section components. */
export interface SectionProps {
  draft: ProductDraft;
  update: (patch: Partial<ProductDraft>) => void;
  errors: FieldErrors;
}

let counter = 0;
/** Keys for items added while editing (initial items use index-based keys). */
export const newKey = (prefix: string) => `${prefix}-n${++counter}`;

const str = (n?: number) => (n === undefined ? "" : String(n));
/** "" → undefined, invalid text → NaN (reported by validation). */
export const parseNum = (s: string) => (s.trim() === "" ? undefined : Number(s.trim().replace(/,/g, "")));

const emptyDims = (): DimensionsDraft => ({ length: "", width: "", height: "", unit: "cm" });
const dimsDraft = (d?: Dimensions): DimensionsDraft =>
  d ? { length: str(d.length), width: str(d.width), height: str(d.height), unit: d.unit } : emptyDims();
/** All empty → no dimensions; otherwise all three are validated. */
const dimsInput = (d: DimensionsDraft): Dimensions | undefined =>
  !d.length.trim() && !d.width.trim() && !d.height.trim()
    ? undefined
    : { length: parseNum(d.length) ?? Number.NaN, width: parseNum(d.width) ?? Number.NaN, height: parseNum(d.height) ?? Number.NaN, unit: d.unit };

/** Tracked stock has a derived status; manual status choices exclude "low stock". */
const manualStatus = (s?: StockStatus): StockStatus => (s === "low_stock" || !s ? "in_stock" : s);

export function newVariation(attrs: Record<string, string>, productSku: string): VariationDraft {
  return {
    key: newKey("var"),
    sku: Object.keys(attrs).length ? variationSku(productSku, attrs) : "",
    gtin: "",
    attributes: attrs,
    status: "active",
    basePrice: "",
    salePrice: "",
    saleScheduled: false,
    saleFrom: "",
    saleTo: "",
    imageKey: "",
    ownImage: [],
    galleryKeys: [],
    description: "",
    stockMode: "track",
    stockQuantity: "",
    stockStatus: "in_stock",
    backorders: "",
    overrideWeight: false,
    weightValue: "",
    weightUnit: "kg",
    overrideDimensions: false,
    dims: emptyDims(),
    shippingClassId: "",
    taxClass: "",
  };
}

export function draftFromProduct(
  p: Product | undefined,
  context: { tags: Tag[]; upsells: ProductPick[]; crossSells: ProductPick[]; units?: FormOptions["units"] },
): ProductDraft {
  const images: ImageDraft[] = (p?.images ?? []).map((img, i) => ({ ...img, key: `img-${i}`, local: false }));
  const imageKeyFor = (src?: string) => images.find((i) => i.src === src)?.key ?? "";
  return {
    legacyWooId: p?.legacyWooId,
    type: p?.type ?? "simple",
    name: p?.name ?? "",
    slug: p?.slug ?? "",
    slugEdited: Boolean(p),
    sku: p?.sku ?? "",
    gtin: p?.gtin ?? "",
    shortDescription: p?.shortDescription ?? "",
    description: p?.description ?? "",
    status: p?.status ?? "draft",
    visibility: p?.visibility ?? "visible",
    featured: p?.featured ?? false,
    categoryIds: p?.categoryIds ?? [],
    tags: (p?.tagIds ?? []).map((id) => context.tags.find((t) => t.id === id)?.name ?? id),
    brandIds: p?.brandIds ?? [],
    images,
    originCountry: p?.originCountry ?? "",
    unitLabel: p?.unitLabel ?? "",
    basePrice: str(p?.basePrice),
    salePrice: str(p?.salePrice),
    saleScheduled: Boolean(p?.saleFrom || p?.saleTo),
    saleFrom: p?.saleFrom ?? "",
    saleTo: p?.saleTo ?? "",
    taxStatus: p?.taxStatus ?? "taxable",
    taxClass: p?.taxClass ?? "standard",
    manageStock: p?.manageStock ?? true,
    stockQuantity: str(p?.manageStock ? p.stock.quantity : undefined),
    stockStatus: manualStatus(p?.stock.status),
    backorders: p?.backorders ?? "no",
    lowStockThreshold: str(p?.lowStockThreshold),
    soldIndividually: p?.soldIndividually ?? false,
    initialStock: str(p?.initialStock),
    unitOfMeasure: p?.unitOfMeasure ?? "",
    weightValue: str(p?.weight.value),
    weightUnit: p?.weight.unit ?? context.units?.weight ?? "kg",
    dims: p ? dimsDraft(p.dimensions) : { ...emptyDims(), unit: context.units?.dimension ?? "cm" },
    shippingClassId: p?.shippingClassId ?? "",
    isVariableWeight: p?.isVariableWeight ?? false,
    attributes: (p?.attributes ?? []).map((a, i) => ({ ...a, values: [...a.values], key: `attr-${i}` })),
    defaultAttributes: { ...(p?.defaultAttributes ?? {}) },
    variations: (p?.variations ?? []).map((v, i) => ({
      key: `var-${i}`,
      id: v.id,
      legacyWooId: v.legacyWooId,
      sku: v.sku,
      gtin: v.gtin ?? "",
      attributes: { ...v.attributes },
      status: v.status,
      basePrice: str(v.basePrice),
      salePrice: str(v.salePrice),
      saleScheduled: Boolean(v.saleFrom || v.saleTo),
      saleFrom: v.saleFrom ?? "",
      saleTo: v.saleTo ?? "",
      imageKey: imageKeyFor(v.image?.src),
      // A variation image that is not in the product gallery is the variation's own image.
      ownImage: v.image && !imageKeyFor(v.image.src) ? [{ ...v.image, key: `var-${i}-img`, local: false }] : [],
      galleryKeys: v.gallery.map((g) => imageKeyFor(g.src)).filter(Boolean),
      description: v.description ?? "",
      stockMode: v.stockMode,
      stockQuantity: str(v.stockMode === "track" ? v.stock.quantity : undefined),
      stockStatus: manualStatus(v.stock.status),
      backorders: v.backorders ?? "",
      overrideWeight: Boolean(v.weight),
      weightValue: str(v.weight?.value),
      weightUnit: v.weight?.unit ?? p?.weight.unit ?? "kg",
      overrideDimensions: Boolean(v.dimensions),
      dims: dimsDraft(v.dimensions),
      shippingClassId: v.shippingClassId ?? "",
      taxClass: v.taxClass ?? "",
    })),
    upsells: context.upsells,
    crossSells: context.crossSells,
    purchaseNote: p?.purchaseNote ?? "",
    menuOrder: str(p?.menuOrder ?? 0),
    reviewsEnabled: p?.reviewsEnabled ?? false,
  };
}

const toImage = (img: ImageDraft) => ({ src: img.src, alt: img.alt, width: img.width, height: img.height });

/** Typed input for validation and saving. Local (unuploaded) images are kept so their alt text is validated. */
export function draftToInput(d: ProductDraft): ProductInput {
  const imageFor = (key: string) => d.images.find((i) => i.key === key);
  const variable = d.type === "variable";
  return {
    type: d.type,
    name: d.name,
    slug: d.slug,
    sku: d.sku,
    gtin: d.gtin.trim() || undefined,
    shortDescription: d.shortDescription,
    description: d.description,
    status: d.status,
    visibility: d.visibility,
    featured: d.featured,
    categoryIds: d.categoryIds,
    tags: d.tags,
    brandIds: d.brandIds,
    images: d.images.map(toImage),
    originCountry: d.originCountry || undefined,
    unitLabel: d.unitLabel,
    basePrice: variable ? undefined : parseNum(d.basePrice),
    salePrice: variable ? undefined : parseNum(d.salePrice),
    saleFrom: !variable && d.saleScheduled ? d.saleFrom || undefined : undefined,
    saleTo: !variable && d.saleScheduled ? d.saleTo || undefined : undefined,
    taxStatus: d.taxStatus,
    taxClass: d.taxClass,
    manageStock: d.manageStock,
    stockQuantity: d.manageStock ? parseNum(d.stockQuantity) : undefined,
    stockStatus: d.stockStatus,
    backorders: d.backorders,
    lowStockThreshold: parseNum(d.lowStockThreshold),
    soldIndividually: d.soldIndividually,
    initialStock: parseNum(d.initialStock),
    unitOfMeasure: d.unitOfMeasure.trim() || undefined,
    weight: { value: parseNum(d.weightValue) ?? Number.NaN, unit: d.weightUnit },
    dimensions: dimsInput(d.dims),
    shippingClassId: d.shippingClassId || undefined,
    isVariableWeight: d.isVariableWeight,
    attributes: d.attributes.map(({ attributeId, name, values, visible, variation }) => ({
      attributeId,
      name: name.trim(),
      values,
      visible,
      variation: variable && variation,
    })),
    defaultAttributes: variable ? Object.fromEntries(Object.entries(d.defaultAttributes).filter(([, v]) => v)) : {},
    variations: variable
      ? d.variations.map((v) => {
          const img = v.ownImage[0] ?? (v.imageKey ? imageFor(v.imageKey) : undefined);
          return {
            id: v.id,
            sku: v.sku,
            gtin: v.gtin.trim() || undefined,
            attributes: v.attributes,
            status: v.status,
            basePrice: parseNum(v.basePrice),
            salePrice: parseNum(v.salePrice),
            saleFrom: v.saleScheduled ? v.saleFrom || undefined : undefined,
            saleTo: v.saleScheduled ? v.saleTo || undefined : undefined,
            image: img ? toImage(img) : undefined,
            gallery: v.galleryKeys.map(imageFor).filter((i): i is ImageDraft => Boolean(i)).map(toImage),
            description: v.description.trim() || undefined,
            stockMode: v.stockMode,
            stockQuantity: v.stockMode === "track" ? parseNum(v.stockQuantity) : undefined,
            stockStatus: v.stockStatus,
            backorders: v.backorders || undefined,
            weight: v.overrideWeight ? { value: parseNum(v.weightValue) ?? Number.NaN, unit: v.weightUnit } : undefined,
            dimensions: v.overrideDimensions ? (dimsInput(v.dims) ?? { length: Number.NaN, width: Number.NaN, height: Number.NaN, unit: v.dims.unit }) : undefined,
            shippingClassId: v.shippingClassId || undefined,
            taxClass: v.taxClass || undefined,
          };
        })
      : [],
    upsellIds: d.upsells.map((p) => p.id),
    crossSellIds: d.crossSells.map((p) => p.id),
    purchaseNote: d.purchaseNote.trim() || undefined,
    menuOrder: parseNum(d.menuOrder) ?? 0,
    reviewsEnabled: d.reviewsEnabled,
  };
}

/** Removes images that only exist in this browser (they cannot be saved without the upload backend). */
export function withoutLocalImages(input: ProductInput, draft: ProductDraft): ProductInput {
  const localSrcs = new Set(
    [...draft.images, ...draft.variations.flatMap((v) => v.ownImage)].filter((i) => i.local).map((i) => i.src),
  );
  return {
    ...input,
    images: input.images.filter((i) => !localSrcs.has(i.src)),
    variations: input.variations.map((v) => ({
      ...v,
      image: v.image && localSrcs.has(v.image.src) ? undefined : v.image,
      gallery: v.gallery.filter((g) => !localSrcs.has(g.src)),
    })),
  };
}

export const autoSlug = (name: string) => slugify(name);

/** Suggested variation SKU, e.g. RICE-BAS-001 + {Size: "20 kg"} → RICE-BAS-001-20-KG */
export const variationSku = (productSku: string, attributes: Record<string, string>) =>
  [productSku || "SKU", ...Object.values(attributes).map((v) => slugify(v).toUpperCase())].filter(Boolean).join("-");

import type { ID, ISODateString, Money, Weight } from "./common";
import type { SiteImage } from "./content";

/** Optional id of the record in a previous system, kept only to map migrated data (none in the sample data). */
export interface LegacyRef {
  legacyWooId?: number;
}

// --- Taxonomies -----------------------------------------------------------------

export type CategoryStatus = "active" | "hidden";

export interface Category extends LegacyRef {
  id: ID;
  slug: string;
  name: string;
  description?: string;
  parentId?: ID;
  /** Hidden categories are not shown on the storefront. */
  status: CategoryStatus;
  image?: ProductImage;
}

export interface Brand extends LegacyRef {
  id: ID;
  slug: string;
  name: string;
  /** Shown in the homepage brands section. Without one, the name is shown. */
  logo?: SiteImage | null;
  showOnHome?: boolean;
  /** Lower comes first on the homepage. */
  displayOrder?: number;
}

export interface BrandInput {
  name: string;
  logo: SiteImage | null;
  showOnHome: boolean;
  displayOrder: number;
}

/** Brand row for the admin brand list. */
export interface AdminBrandRow extends Brand {
  productCount: number;
}

export interface Tag extends LegacyRef {
  id: ID;
  slug: string;
  name: string;
}

export interface AttributeValue extends LegacyRef {
  id: ID;
  slug: string;
  name: string;
}

/** Store-wide reusable attribute (e.g. Size) with a shared list of values. */
export interface Attribute extends LegacyRef {
  id: ID;
  slug: string;
  name: string;
  values: AttributeValue[];
}

/** References future shipping-rate settings; rates are not calculated in the frontend. */
export interface ShippingClass {
  id: ID;
  name: string;
  description?: string;
  /** Added to the shipping charge when the cart has this class. */
  surcharge?: Money;
  surchargePer?: "order" | "unit";
}

/**
 * Tax class key. The classes and their rates are configured in the backend tax settings;
 * these keys are placeholders until the store's VAT setup is agreed.
 */
export type TaxClass = "standard" | "reduced" | "exempt";

export interface TaxClassOption {
  id: TaxClass;
  name: string;
}

/** Whether the product, its shipping only, or nothing is taxable. */
export type TaxStatus = "taxable" | "shipping" | "none";

// --- Shared value types -------------------------------------------------------------

export interface ProductImage {
  /** Absolute URL or path under /public. Never a base64 data URI. */
  src: string;
  alt: string;
  width: number;
  height: number;
}

export type StockStatus = "in_stock" | "low_stock" | "out_of_stock" | "backorder";

export interface StockInfo {
  status: StockStatus;
  /** Units available; omitted when not tracked or not exposed. */
  quantity?: number;
}

/** Where a stock change came from. */
export type StockMovementSource = "product_edit" | "order_page" | "refund_restock" | "inventory_adjust";

/**
 * One change to a product's (or option's) stock, kept as an audit trail. The backend owns stock and
 * must also record reservations and deductions when orders are placed — the demo does not deduct stock.
 */
/** One stockable line on the inventory screen. */
export interface InventoryRow {
  productId: ID;
  productName: string;
  variationId?: ID;
  variationLabel?: string;
  sku: string;
  stock: StockInfo;
  /** "quantity" = counted; "status" = marked in or out of stock. */
  mode: "quantity" | "status";
  /** Options sharing the product's stock change together. */
  shared: boolean;
  lowStockThreshold?: number;
  unavailable?: string;
}

export interface StockMovement {
  id: ID;
  productId: ID;
  variationId?: ID;
  /** e.g. "Size: 5 kg"; absent for the product itself. */
  variationLabel?: string;
  sku: string;
  source: StockMovementSource;
  before: StockInfo;
  after: StockInfo;
  /** Units added (positive) or removed (negative), when stock is counted. */
  change?: number;
  orderId?: ID;
  orderNumber?: string;
  note?: string;
  at: ISODateString;
  byName: string;
}

/** Whether orders may exceed available stock. */
export type BackorderPolicy = "no" | "notify" | "allow";

/**
 * Per-product ordering settings. `step` (pack multiple) is still a product setting.
 * `min`/`max` are LEGACY: per-line limits now come from quantity rules
 * (QuantityLimitRule, resolved by src/lib/pricing/engine.ts); the seeded values were migrated there.
 */
export interface QuantityRule {
  /** @deprecated Use the effective quantity rule (repositories.quantityRules.effectiveFor). */
  min: number;
  /** @deprecated Use the effective quantity rule (repositories.quantityRules.effectiveFor). */
  max?: number;
  step: number;
}

export type DimensionUnit = "cm" | "mm" | "m";

export interface Dimensions {
  length: number;
  width: number;
  height: number;
  unit: DimensionUnit;
}

/** Inventory settings of a product (for variable products: the parent level). */
export interface Inventory {
  /** Track a quantity (true) or set `stock.status` by hand (false). */
  manageStock: boolean;
  /** Current stock; `status` is derived by the backend when the quantity is tracked. */
  stock: StockInfo;
  backorders: BackorderPolicy;
  /** Undefined = the store default threshold (a backend setting). */
  lowStockThreshold?: number;
  /** Limit to one unit per order. */
  soldIndividually: boolean;
}

/** Shipping data. Shipping rates are a future settings module. */
export interface Shipping {
  weight: Weight;
  dimensions?: Dimensions;
  shippingClassId?: ID;
}

// --- Products -------------------------------------------------------------------------

export type ProductStatus = "draft" | "published" | "archived";

/** Simple = one SKU/price/stock. Variable = options (e.g. size) with their own SKU/price/stock. */
export type ProductType = "simple" | "variable";

/**
 * Where a published product appears: everywhere, only when browsing the catalog,
 * only in search results, or nowhere (reachable by direct link only).
 */
export type ProductVisibility = "visible" | "catalog" | "search" | "hidden";

/** An attribute on one product: a store-wide attribute or a product-specific (custom) one. */
export interface ProductAttribute {
  /** Set for store-wide attributes; omitted for product-specific ones. */
  attributeId?: ID;
  name: string;
  /** Value names used on this product. */
  values: string[];
  /** Shown in the product page's "Additional information". */
  visible: boolean;
  /** Used to create variations (variable products only). */
  variation: boolean;
}

export type VariationStatus = "active" | "disabled";

/** "parent" = uses the product-level stock; "track" = own quantity; "status" = own manual status. */
export type VariationStockMode = "parent" | "track" | "status";

export interface ProductVariation extends LegacyRef {
  id: ID;
  sku: string;
  gtin?: string;
  /** One value per variation attribute, e.g. { Size: "5 kg" }. */
  attributes: Record<string, string>;
  status: VariationStatus;
  /** Admin responses only — customers get prices from the pricing endpoint. */
  basePrice?: Money;
  salePrice?: Money;
  /** Optional sale schedule (calendar dates, store time zone). */
  saleFrom?: string;
  saleTo?: string;
  image?: ProductImage;
  gallery: ProductImage[];
  description?: string;
  stockMode: VariationStockMode;
  /** Effective stock (own, or the parent's when `stockMode` is "parent"). */
  stock: StockInfo;
  backorders?: BackorderPolicy;
  // Overrides — undefined means "same as parent".
  weight?: Weight;
  dimensions?: Dimensions;
  shippingClassId?: ID;
  taxClass?: TaxClass;
  quantityRule?: QuantityRule;
}

export interface Product extends LegacyRef, Inventory, Shipping {
  id: ID;
  type: ProductType;
  slug: string;
  sku: string;
  /** GTIN / EAN / UPC / barcode. */
  gtin?: string;
  name: string;
  shortDescription: string;
  description: string;
  status: ProductStatus;
  visibility: ProductVisibility;
  featured: boolean;
  categoryIds: ID[];
  tagIds: ID[];
  /** A product may carry several brands (as on the old store). */
  brandIds: ID[];
  /** First image is the main image; the rest form the gallery. */
  images: ProductImage[];
  /** Country of origin (ISO 3166-1 alpha-2, e.g. "JP"). Independent of the store location. */
  originCountry?: string;
  /** Selling unit shown to customers, e.g. "case", "bag", "pack". */
  unitLabel: string;
  /** Simple products: admin responses only. */
  basePrice?: Money;
  salePrice?: Money;
  saleFrom?: string;
  saleTo?: string;
  taxStatus: TaxStatus;
  taxClass: TaxClass;
  /** Imported "initial number in stock" from the old store. Stored as-is; no business logic. */
  initialStock?: number;
  /** Imported "unit of measurement" from the old store. Stored as-is; meaning to be confirmed. */
  unitOfMeasure?: string;
  /** Extension point for the future Rules module; not edited in the product form. */
  quantityRule: QuantityRule;
  /** Priced per kg and adjusted after packing (e.g. fresh meat). Final amount can change. */
  isVariableWeight: boolean;
  attributes: ProductAttribute[];
  /** Pre-selected option per variation attribute on the product page. */
  defaultAttributes: Record<string, string>;
  variations: ProductVariation[];
  upsellIds: ID[];
  crossSellIds: ID[];
  /** Shown to the customer after purchase. */
  purchaseNote?: string;
  /** Manual sort position (lower first). */
  menuOrder: number;
  reviewsEnabled: boolean;
  updatedAt: ISODateString;
}

/** Lightweight shape for public listings; keeps list payloads small. */
export type ProductSummary = Pick<
  Product,
  | "id"
  | "slug"
  | "sku"
  | "name"
  | "shortDescription"
  | "unitLabel"
  | "basePrice"
  | "stock"
  | "weight"
  | "isVariableWeight"
  | "categoryIds"
> & { image?: ProductImage; hasVariations: boolean };

/** Brand with the number of publicly listed products (shop filter). */
export interface BrandFacet extends Brand {
  productCount: number;
}

/** Minimal product reference for pickers (linked products, category assignment). */
export interface ProductPick {
  id: ID;
  name: string;
  sku: string;
  type: ProductType;
  status: ProductStatus;
  image?: ProductImage;
}

/** Row shape for the admin product list. */
export interface AdminProductRow {
  id: ID;
  type: ProductType;
  slug: string;
  sku: string;
  name: string;
  status: ProductStatus;
  visibility: ProductVisibility;
  image?: ProductImage;
  categoryNames: string[];
  /** Simple: the price. Variable: lowest–highest active variation price. */
  price?: { min: Money; max: Money };
  /** Simple products only. */
  salePrice?: Money;
  stock: StockInfo;
  weight: Weight;
  originCountry?: string;
  variationCount: number;
  /** Enabled variations without a price (cannot be purchased). */
  unpricedVariations: number;
  updatedAt: ISODateString;
}

/** Category row for the admin category list. */
export interface AdminCategoryRow extends Category {
  /** "Parent › Child" display path. */
  path: string;
  depth: number;
  productCount: number;
}

// --- Editing payloads (what the admin forms send) ------------------------------

export interface VariationInput {
  /** Omitted for new variations. */
  id?: ID;
  sku: string;
  gtin?: string;
  attributes: Record<string, string>;
  status: VariationStatus;
  basePrice?: Money;
  salePrice?: Money;
  saleFrom?: string;
  saleTo?: string;
  image?: ProductImage;
  gallery: ProductImage[];
  description?: string;
  stockMode: VariationStockMode;
  /** Used when `stockMode` is "track". */
  stockQuantity?: number;
  /** Used when `stockMode` is "status". */
  stockStatus: StockStatus;
  backorders?: BackorderPolicy;
  /** Overrides; undefined = same as parent. */
  weight?: Weight;
  dimensions?: Dimensions;
  shippingClassId?: ID;
  taxClass?: TaxClass;
}

export interface ProductInput {
  type: ProductType;
  name: string;
  slug: string;
  sku: string;
  gtin?: string;
  shortDescription: string;
  description: string;
  status: ProductStatus;
  visibility: ProductVisibility;
  featured: boolean;
  categoryIds: ID[];
  /** Tag names; unknown names create new tags. */
  tags: string[];
  brandIds: ID[];
  images: ProductImage[];
  originCountry?: string;
  unitLabel: string;
  basePrice?: Money;
  salePrice?: Money;
  saleFrom?: string;
  saleTo?: string;
  taxStatus: TaxStatus;
  taxClass: TaxClass;
  manageStock: boolean;
  stockQuantity?: number;
  stockStatus: StockStatus;
  backorders: BackorderPolicy;
  lowStockThreshold?: number;
  soldIndividually: boolean;
  initialStock?: number;
  unitOfMeasure?: string;
  weight: Weight;
  dimensions?: Dimensions;
  shippingClassId?: ID;
  isVariableWeight: boolean;
  attributes: ProductAttribute[];
  defaultAttributes: Record<string, string>;
  variations: VariationInput[];
  upsellIds: ID[];
  crossSellIds: ID[];
  purchaseNote?: string;
  menuOrder: number;
  reviewsEnabled: boolean;
}

export interface CategoryInput {
  name: string;
  slug: string;
  parentId?: ID;
  description?: string;
  status: CategoryStatus;
  image?: ProductImage;
}

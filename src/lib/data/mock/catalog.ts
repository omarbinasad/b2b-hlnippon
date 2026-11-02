import type { Attribute, Brand, Category, Product, ShippingClass, Tag, TaxClassOption } from "@/lib/types";
import { sampleBrands, sampleCategories, sampleProducts, sampleTags } from "./sample-catalog";

/*
 * Hand-written demo categories. HIDDEN from the storefront (navigation, shop filters, public
 * listings) because the sample catalog (./sample-catalog.ts) is the storefront data; the records stay so demo
 * orders, pricing rules and admin screens keep working. Re-activate one in Admin → Categories.
 */
const seedCategories: Category[] = [
  { id: "cat-rice", slug: "rice-grains", name: "Rice & Grains", description: "Basmati, parboiled and short-grain rice.", status: "hidden" },
  { id: "cat-flour", slug: "flour-sugar", name: "Flour & Sugar", description: "Atta, flour and sugar in bulk sacks.", status: "hidden" },
  { id: "cat-oils", slug: "oils-ghee", name: "Oils & Ghee", description: "Cooking oils and ghee in bulk sizes.", status: "hidden" },
  { id: "cat-pulses", slug: "lentils-beans", name: "Lentils & Beans", description: "Dried pulses for restaurants and retail.", status: "hidden" },
  { id: "cat-spices", slug: "spices", name: "Spices & Seasonings", description: "Whole and ground spices in catering sizes.", status: "hidden" },
  { id: "cat-meat", slug: "frozen-meat", name: "Frozen Meat & Poultry", description: "Frozen cuts priced by weight.", status: "hidden" },
  { id: "cat-drinks", slug: "beverages-tea", name: "Beverages & Tea", description: "Tea, juices and water by the case.", status: "hidden" },
  { id: "cat-japanese", slug: "japanese-pantry", name: "Japanese Pantry", description: "Rice, sauces and tea imported from Japan.", status: "hidden" },
  { id: "cat-tea", slug: "tea", name: "Tea", parentId: "cat-drinks", description: "Loose-leaf and bagged tea.", status: "hidden" },
  { id: "cat-seasonal", slug: "seasonal", name: "Seasonal", description: "Limited-time seasonal items.", status: "hidden" },
];

const updatedAt = "2026-09-01T09:00:00+09:00";

type Defaults =
  | "type" | "status" | "visibility" | "featured" | "images" | "variations" | "attributes" | "defaultAttributes" | "updatedAt"
  | "quantityRule" | "isVariableWeight" | "manageStock" | "backorders" | "soldIndividually" | "taxStatus" | "tagIds"
  | "upsellIds" | "crossSellIds" | "menuOrder" | "reviewsEnabled" | "brandIds";
type Draft = Omit<Product, Defaults> & Partial<Pick<Product, Defaults>>;

/** Fills defaults; type, attributes and stock tracking are derived from the data given. */
const product = (p: Draft): Product => {
  const variations = p.variations ?? [];
  const attributeNames = [...new Set(variations.flatMap((v) => Object.keys(v.attributes)))];
  return {
    type: variations.length ? "variable" : "simple",
    status: "published",
    visibility: "visible",
    featured: false,
    images: [],
    tagIds: [],
    brandIds: [],
    quantityRule: { min: 1, step: 1 },
    isVariableWeight: false,
    manageStock: p.stock.quantity !== undefined,
    backorders: "no",
    soldIndividually: false,
    taxStatus: "taxable",
    attributes: attributeNames.map((name) => ({
      attributeId: name === "Size" ? "attr-size" : undefined,
      name,
      values: [...new Set(variations.map((v) => v.attributes[name]).filter(Boolean))],
      visible: true,
      variation: true,
    })),
    defaultAttributes: {},
    upsellIds: [],
    crossSellIds: [],
    menuOrder: 0,
    reviewsEnabled: false,
    updatedAt,
    ...p,
    variations,
  };
};

const seedProducts: Product[] = [
  product({
    id: "p-001",
    slug: "basmati-rice-premium",
    sku: "RICE-BAS-001",
    name: "Premium Basmati Rice",
    shortDescription: "Long-grain aged basmati rice.",
    description: "Aged long-grain basmati rice suitable for biryani and polao. Available in 5 kg and 20 kg bags.",
    categoryIds: ["cat-rice"],
    originCountry: "IN",
    unitLabel: "bag",
    basePrice: 1440,
    taxClass: "reduced",
    stock: { status: "in_stock", quantity: 240 },
    weight: { value: 5, unit: "kg" },
    legacyWooId: 3101,
    brandIds: ["brand-sample-foods"],
    tagIds: ["tag-bestseller", "tag-restaurant-pack"],
    defaultAttributes: { Size: "5 kg" },
    reviewsEnabled: true,
    variations: [
      { id: "p-001-5", sku: "RICE-BAS-001-5", attributes: { Size: "5 kg" }, basePrice: 1440, status: "active", stockMode: "track", stock: { status: "in_stock", quantity: 180 }, gallery: [], legacyWooId: 3102 },
      { id: "p-001-20", sku: "RICE-BAS-001-20", attributes: { Size: "20 kg" }, basePrice: 5500, salePrice: 5310, status: "active", stockMode: "track", stock: { status: "in_stock", quantity: 60 }, gallery: [], weight: { value: 20, unit: "kg" }, shippingClassId: "ship-heavy", quantityRule: { min: 1, max: 20, step: 1 }, legacyWooId: 3103 },
    ],
  }),
  product({
    id: "p-002",
    legacyWooId: 3110,
    brandIds: ["brand-demo-mills"],
    tagIds: ["tag-bulk"],
    shippingClassId: "ship-heavy",
    dimensions: { length: 80, width: 50, height: 15, unit: "cm" },
    initialStock: 400,
    unitOfMeasure: "sack",
    slug: "parboiled-rice-25kg",
    sku: "RICE-PAR-002",
    name: "Parboiled Rice",
    shortDescription: "Medium-grain parboiled rice, 25 kg sack.",
    description: "Medium-grain parboiled rice in 25 kg sacks for restaurants and caterers.",
    categoryIds: ["cat-rice"],
    originCountry: "BD",
    unitLabel: "sack",
    basePrice: 2310,
    taxClass: "exempt",
    stock: { status: "in_stock", quantity: 320 },
    weight: { value: 25, unit: "kg" },
  }),
  product({
    id: "p-003",
    slug: "wheat-flour-atta-10kg",
    sku: "FLR-ATT-003",
    name: "Wheat Flour (Atta)",
    shortDescription: "Whole-wheat atta, 10 kg bag.",
    description: "Stone-ground whole-wheat atta in 10 kg bags.",
    categoryIds: ["cat-flour"],
    originCountry: "BD",
    unitLabel: "bag",
    basePrice: 780,
    taxClass: "exempt",
    stock: { status: "in_stock", quantity: 410 },
    weight: { value: 10, unit: "kg" },
  }),
  product({
    id: "p-004",
    upsellIds: ["p-003"],
    crossSellIds: ["p-007"],
    purchaseNote: "Store in a dry place. Delivered on pallets for orders over 10 sacks.",
    slug: "refined-sugar-50kg",
    sku: "FLR-SUG-004",
    name: "Refined Sugar",
    shortDescription: "White refined sugar, 50 kg sack.",
    description: "Refined white sugar in 50 kg sacks.",
    categoryIds: ["cat-flour"],
    originCountry: "BR",
    unitLabel: "sack",
    basePrice: 7750,
    taxClass: "reduced",
    stock: { status: "in_stock", quantity: 85 },
    weight: { value: 50, unit: "kg" },
  }),
  product({
    id: "p-005",
    shippingClassId: "ship-frozen",
    tagIds: ["tag-frozen"],
    slug: "frozen-chicken-thigh",
    sku: "MEAT-CHK-005",
    name: "Frozen Boneless Chicken Thigh",
    shortDescription: "Boneless thigh, approx. 2 kg pack, priced by weight.",
    description: "Frozen boneless chicken thigh. Sold in approx. 2 kg packs; the final price is adjusted to the packed weight.",
    categoryIds: ["cat-meat"],
    originCountry: "BD",
    unitLabel: "pack",
    basePrice: 1480,
    taxClass: "reduced",
    stock: { status: "in_stock", quantity: 60 },
    weight: { value: 2, unit: "kg" },
    quantityRule: { min: 1, max: 30, step: 1 },
    isVariableWeight: true,
  }),
  product({
    id: "p-006",
    shippingClassId: "ship-frozen",
    tagIds: ["tag-frozen"],
    backorders: "notify",
    slug: "frozen-lamb-shoulder",
    sku: "MEAT-LMB-006",
    name: "Frozen Lamb Shoulder (Bone-in)",
    shortDescription: "Bone-in lamb shoulder, approx. 2.5 kg, priced by weight.",
    description: "Frozen bone-in lamb shoulder. Approx. 2.5 kg per piece; final price follows packed weight.",
    categoryIds: ["cat-meat"],
    originCountry: "AU",
    unitLabel: "piece",
    basePrice: 4250,
    taxClass: "reduced",
    stock: { status: "out_of_stock", quantity: 0 },
    weight: { value: 2.5, unit: "kg" },
    isVariableWeight: true,
  }),
  product({
    id: "p-007",
    slug: "pure-ghee-tin",
    sku: "OIL-GHE-007",
    name: "Pure Ghee",
    shortDescription: "Clarified butter, 1.6 kg tin.",
    description: "Pure clarified butter in 1.6 kg tins.",
    categoryIds: ["cat-oils"],
    originCountry: "BD",
    unitLabel: "tin",
    basePrice: 2880,
    taxClass: "reduced",
    stock: { status: "in_stock", quantity: 72 },
    weight: { value: 1.6, unit: "kg" },
  }),
  product({
    id: "p-008",
    slug: "mustard-oil-5l",
    sku: "OIL-MUS-008",
    name: "Mustard Oil (5 L)",
    shortDescription: "Cold-pressed mustard oil, 5 L can.",
    description: "Cold-pressed mustard oil in 5 L cans.",
    categoryIds: ["cat-oils"],
    originCountry: "BD",
    unitLabel: "can",
    basePrice: 1560,
    taxClass: "reduced",
    stock: { status: "low_stock", quantity: 8 },
    weight: { value: 4.6, unit: "kg" },
  }),
  product({
    id: "p-009",
    slug: "red-lentils-25kg",
    sku: "PUL-RED-009",
    name: "Red Lentils (Masoor Dal)",
    shortDescription: "Split red lentils, 25 kg sack.",
    description: "Cleaned split red lentils in 25 kg sacks.",
    categoryIds: ["cat-pulses"],
    originCountry: "AU",
    unitLabel: "sack",
    basePrice: 3940,
    taxClass: "exempt",
    stock: { status: "in_stock", quantity: 130 },
    weight: { value: 25, unit: "kg" },
  }),
  product({
    id: "p-010",
    slug: "chickpeas-25kg",
    sku: "PUL-CHK-010",
    name: "Chickpeas (Kabuli Chana)",
    shortDescription: "Dried chickpeas, 25 kg sack.",
    description: "Large dried kabuli chickpeas in 25 kg sacks.",
    categoryIds: ["cat-pulses"],
    originCountry: "AU",
    unitLabel: "sack",
    basePrice: 3630,
    taxClass: "exempt",
    stock: { status: "low_stock", quantity: 6 },
    weight: { value: 25, unit: "kg" },
  }),
  product({
    id: "p-011",
    slug: "ground-cumin-1kg",
    sku: "SPC-CUM-011",
    name: "Ground Cumin",
    shortDescription: "Ground cumin, 1 kg catering pack.",
    description: "Finely ground cumin in a resealable 1 kg catering pack.",
    categoryIds: ["cat-spices"],
    originCountry: "IN",
    unitLabel: "pack",
    basePrice: 980,
    taxClass: "reduced",
    stock: { status: "in_stock", quantity: 150 },
    weight: { value: 1, unit: "kg" },
    quantityRule: { min: 2, step: 2 },
  }),
  product({
    id: "p-012",
    slug: "garam-masala-500g",
    sku: "SPC-GAR-012",
    name: "Garam Masala",
    shortDescription: "Blended spice mix, 500 g pack.",
    description: "Traditional garam masala blend in 500 g packs.",
    categoryIds: ["cat-spices"],
    originCountry: "BD",
    unitLabel: "pack",
    basePrice: 650,
    taxClass: "reduced",
    stock: { status: "in_stock", quantity: 95 },
    weight: { value: 500, unit: "g" },
  }),
  product({
    id: "p-013",
    dimensions: { length: 40, width: 27, height: 12, unit: "cm" },
    lowStockThreshold: 20,
    slug: "mango-juice-case",
    sku: "BEV-MNG-013",
    name: "Mango Juice",
    shortDescription: "Mango drink, 24 × 250 ml case.",
    description: "Mango drink in 250 ml cartons, 24 per case.",
    categoryIds: ["cat-drinks"],
    originCountry: "BD",
    unitLabel: "case",
    basePrice: 900,
    salePrice: 810,
    taxClass: "standard",
    stock: { status: "in_stock", quantity: 55 },
    weight: { value: 6.4, unit: "kg" },
  }),
  product({
    id: "p-014",
    slug: "distilled-water-case",
    sku: "BEV-WAT-014",
    name: "Distilled Water (1 L)",
    shortDescription: "Distilled water, 12 × 1 L case.",
    description: "Distilled drinking water in 1 L bottles, 12 per case.",
    categoryIds: ["cat-drinks"],
    originCountry: "BD",
    unitLabel: "case",
    basePrice: 450,
    taxClass: "standard",
    stock: { status: "low_stock", quantity: 12 },
    weight: { value: 12.5, unit: "kg" },
  }),
  product({
    id: "p-015",
    brandIds: ["brand-example-imports"],
    tagIds: ["tag-imported"],
    slug: "japanese-short-grain-rice",
    sku: "JPN-RIC-015",
    name: "Japanese Short-Grain Rice",
    shortDescription: "Short-grain table rice, 10 kg bag. Imported from Japan.",
    description: "Japanese short-grain rice for sushi and table rice, 10 kg bags. Imported from Japan.",
    categoryIds: ["cat-rice", "cat-japanese"],
    originCountry: "JP",
    unitLabel: "bag",
    basePrice: 4500,
    taxClass: "reduced",
    stock: { status: "in_stock", quantity: 44 },
    weight: { value: 10, unit: "kg" },
  }),
  product({
    id: "p-016",
    shippingClassId: "ship-fragile",
    brandIds: ["brand-example-imports"],
    tagIds: ["tag-imported"],
    slug: "japanese-soy-sauce",
    sku: "JPN-SOY-016",
    name: "Japanese Soy Sauce (1.8 L)",
    shortDescription: "Naturally brewed soy sauce, 1.8 L bottle. Imported from Japan.",
    description: "Naturally brewed soy sauce in 1.8 L bottles, 6 per case. Imported from Japan.",
    categoryIds: ["cat-japanese"],
    originCountry: "JP",
    unitLabel: "bottle",
    basePrice: 1190,
    taxClass: "reduced",
    stock: { status: "in_stock", quantity: 120 },
    weight: { value: 2.1, unit: "kg" },
  }),
  product({
    id: "p-017",
    brandIds: ["brand-example-imports"],
    tagIds: ["tag-imported"],
    slug: "japanese-green-tea-1kg",
    sku: "JPN-TEA-017",
    name: "Premium Green Tea (1 kg)",
    shortDescription: "Sencha loose-leaf green tea, 1 kg. Imported from Japan.",
    description: "Loose-leaf sencha green tea in 1 kg foil bags. Imported from Japan.",
    categoryIds: ["cat-tea", "cat-japanese"],
    originCountry: "JP",
    unitLabel: "bag",
    basePrice: 6000,
    taxClass: "reduced",
    stock: { status: "in_stock", quantity: 38 },
    weight: { value: 1, unit: "kg" },
  }),
  product({
    id: "p-018",
    slug: "disposable-food-containers",
    sku: "SUP-CON-018",
    name: "Takeaway Food Containers",
    shortDescription: "Microwave-safe containers, 300 pcs.",
    description: "Microwave-safe takeaway containers with lids, 300 pieces per case.",
    categoryIds: [],
    originCountry: "BD",
    unitLabel: "case",
    basePrice: 2630,
    taxClass: "standard",
    stock: { status: "in_stock", quantity: 40 },
    weight: { value: 7, unit: "kg" },
  }),
  product({
    id: "p-019",
    slug: "japanese-matcha-powder",
    sku: "JPN-MAT-019",
    name: "Matcha Powder (500 g)",
    shortDescription: "Culinary-grade matcha, 500 g pouch. Imported from Japan.",
    description: "Culinary-grade matcha green tea powder for drinks and baking. Imported from Japan.",
    status: "draft",
    categoryIds: ["cat-tea", "cat-japanese"],
    originCountry: "JP",
    unitLabel: "pouch",
    basePrice: 4880,
    taxClass: "reduced",
    stock: { status: "in_stock", quantity: 20 },
    weight: { value: 500, unit: "g" },
  }),
  product({
    id: "p-020",
    slug: "medjool-dates-gift-box",
    sku: "SEA-DAT-020",
    name: "Medjool Dates Gift Box",
    shortDescription: "Seasonal gift box, 1 kg.",
    description: "Premium Medjool dates in a 1 kg gift box. Seasonal item.",
    status: "archived",
    visibility: "hidden",
    categoryIds: ["cat-seasonal"],
    originCountry: "SA",
    unitLabel: "box",
    basePrice: 3000,
    taxClass: "reduced",
    stock: { status: "out_of_stock", quantity: 0 },
    weight: { value: 1, unit: "kg" },
  }),
];

const seedBrands: Brand[] = [
  { id: "brand-sample-foods", slug: "sample-foods", name: "Sample Foods" },
  { id: "brand-demo-mills", slug: "demo-mills", name: "Demo Mills" },
  { id: "brand-example-imports", slug: "example-imports", name: "Example Imports" },
  { id: "brand-house", slug: "house-brand", name: "House brand" },
];

const seedTags: Tag[] = [
  { id: "tag-bestseller", slug: "bestseller", name: "Bestseller" },
  { id: "tag-restaurant-pack", slug: "restaurant-pack", name: "Restaurant pack" },
  { id: "tag-bulk", slug: "bulk", name: "Bulk" },
  { id: "tag-imported", slug: "imported", name: "Imported" },
  { id: "tag-frozen", slug: "frozen", name: "Frozen" },
  { id: "tag-new", slug: "new", name: "New" },
];

const value = (attr: string, name: string) => ({ id: `${attr}-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"), name });
const seedAttributes: Attribute[] = [
  { id: "attr-size", slug: "size", name: "Size", values: ["500 g", "1 kg", "2 kg", "5 kg", "10 kg", "20 kg", "25 kg", "50 kg"].map((v) => value("size", v)) },
  { id: "attr-pack", slug: "pack-size", name: "Pack size", values: ["Single", "6-pack", "12-pack", "24-pack"].map((v) => value("pack", v)) },
  { id: "attr-grade", slug: "grade", name: "Grade", values: ["Premium", "Standard", "Economy"].map((v) => value("grade", v)) },
  { id: "attr-colour", slug: "colour", name: "Colour", values: ["Red", "Green", "Yellow", "White"].map((v) => value("colour", v)) },
];

/** Placeholder classes; the shipping-rate module will attach rates to them. */
const seedShippingClasses: ShippingClass[] = [
  { id: "ship-standard", name: "Standard", description: "Regular dry goods" },
  { id: "ship-heavy", name: "Heavy / bulky", description: "Sacks of 20 kg and more" },
  { id: "ship-frozen", name: "Frozen (cold chain)", description: "Needs refrigerated transport" },
  { id: "ship-fragile", name: "Fragile", description: "Glass bottles and jars" },
];

/** Placeholder keys until the VAT setup is agreed (see TaxClass). */
export const mockTaxClasses: TaxClassOption[] = [
  { id: "standard", name: "Standard rate" },
  { id: "reduced", name: "Reduced rate" },
  { id: "exempt", name: "Exempt" },
];

/*
 * The admin demo edits these arrays in memory. They live on globalThis so every
 * module copy in the server process (routes, server actions) shares one store.
 * Changes are lost when the server restarts.
 *
 * The store starts from the hand-written demo records above (referenced by demo orders)
 * plus the standalone sample catalog (fixture, see ./sample-catalog.ts).
 * Copies are made so demo edits never touch the fixture module.
 */
interface CatalogStore {
  products: Product[];
  categories: Category[];
  brands: Brand[];
  tags: Tag[];
  attributes: Attribute[];
  shippingClasses: ShippingClass[];
}
const store = globalThis as typeof globalThis & { __mockCatalogV6?: CatalogStore };
store.__mockCatalogV6 ??= {
  products: [...seedProducts, ...structuredClone(sampleProducts)],
  categories: [...seedCategories, ...structuredClone(sampleCategories)],
  brands: [...seedBrands, ...structuredClone(sampleBrands)],
  tags: [...seedTags, ...structuredClone(sampleTags)],
  attributes: seedAttributes,
  shippingClasses: seedShippingClasses,
};

export const mockProducts = store.__mockCatalogV6.products;
export const mockCategories = store.__mockCatalogV6.categories;
export const mockBrands = store.__mockCatalogV6.brands;
export const mockTags = store.__mockCatalogV6.tags;
export const mockAttributes = store.__mockCatalogV6.attributes;
export const mockShippingClasses = store.__mockCatalogV6.shippingClasses;

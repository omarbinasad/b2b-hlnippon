/**
 * ARCHIVED — not used by the app, build or tests (see scripts/legacy/README.md).
 *
 * One-off / repeatable DEVELOPMENT import of the old WooCommerce catalog.
 *
 *   npm run import:woocommerce            (default: 60 parent products)
 *   npm run import:woocommerce -- --limit=80
 *
 * Reads WC_SOURCE_URL, WC_CONSUMER_KEY and WC_CONSUMER_SECRET from .env.local (local only —
 * never printed, never needed by the app or by builds). Read-only: it only calls catalog GET
 * endpoints of the WooCommerce REST API v3 over HTTPS, and downloads product/category images
 * WITHOUT credentials.
 *
 * Output (commit these; the running site and Vercel builds use them, never WordPress):
 *   src/lib/data/fixtures/woocommerce-catalog.json   categories, brands, tags, products
 *   public/images/products/, public/images/categories/   downloaded images
 *   docs/woocommerce-import-report.md                counts, failures, unsupported fields
 *
 * Reruns update records by their WooCommerce ID (stable ids "wc-<id>"); products imported
 * earlier stay selected while still published. Demo records in src/lib/data/mock are untouched.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { decodeEntities, htmlToText, sanitizeHtml } from "../src/lib/html/sanitize.ts";
import type {
  BackorderPolicy,
  Brand,
  Category,
  Dimensions,
  ImportSource,
  Product,
  ProductAttribute,
  ProductImage,
  ProductVariation,
  ProductVisibility,
  StockStatus,
  Tag,
  TaxClass,
  TaxStatus,
} from "../src/lib/types/index.ts";
import { LIMITS, slugify } from "../src/lib/validation/product.ts";

// --- Paths & options ------------------------------------------------------------------

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ENV_FILE = join(ROOT, ".env.local");
const FIXTURE = join(ROOT, "src/lib/data/fixtures/woocommerce-catalog.json");
const REPORT = join(ROOT, "docs/woocommerce-import-report.md");
const DEMO_CATALOG = join(ROOT, "src/lib/data/mock/catalog.ts");
const IMAGE_DIRS = { products: join(ROOT, "public/images/products"), categories: join(ROOT, "public/images/categories") };
/** Store currency (src/config/site.ts). Source prices are only copied when they match. */
const STORE_CURRENCY = "BDT";

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
const LIMIT = Math.max(1, Number(arg("limit") ?? 60) || 60);
const IMAGE_CONCURRENCY = 4;
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

// --- Woo shapes (only the fields we read) ---------------------------------------------

interface WooTerm { id: number; name: string; slug: string }
interface WooImage { id: number; src: string; name?: string; alt?: string }
interface WooAttribute { id: number; name: string; options?: string[]; option?: string; visible?: boolean; variation?: boolean }
interface WooMeta { key: string; value: unknown }
interface WooDimensions { length: string; width: string; height: string }
interface WooCommon {
  id: number;
  sku: string;
  global_unique_id?: string;
  regular_price: string;
  sale_price: string;
  date_on_sale_from: string | null;
  date_on_sale_to: string | null;
  tax_status: string;
  tax_class: string;
  manage_stock: boolean | "parent";
  stock_quantity: number | null;
  stock_status: string;
  backorders: string;
  weight: string;
  dimensions: WooDimensions;
  shipping_class: string;
  meta_data?: WooMeta[];
}
interface WooProduct extends WooCommon {
  name: string;
  slug: string;
  type: string;
  status: string;
  featured: boolean;
  catalog_visibility: string;
  description: string;
  short_description: string;
  low_stock_amount: number | null;
  sold_individually: boolean;
  reviews_allowed: boolean;
  upsell_ids: number[];
  cross_sell_ids: number[];
  purchase_note: string;
  categories: WooTerm[];
  tags: WooTerm[];
  brands?: WooTerm[];
  images: WooImage[];
  attributes: WooAttribute[];
  default_attributes: WooAttribute[];
  variations: number[];
  menu_order: number;
  date_modified_gmt: string | null;
}
interface WooVariation extends WooCommon {
  status: string;
  description: string;
  image: WooImage | null;
  attributes: WooAttribute[];
}
interface WooCategory { id: number; name: string; slug: string; parent: number; description: string; display: string; menu_order: number; count: number; image: WooImage | null }

interface Fixture {
  meta: Record<string, unknown>;
  categories: Category[];
  brands: Brand[];
  tags: Tag[];
  products: Product[];
}

// --- Credentials (never printed) ------------------------------------------------------

class AccessError extends Error {}

function readEnv(): { base: URL; auth: string } {
  if (!existsSync(ENV_FILE)) throw new AccessError(".env.local not found in the project root.");
  const env: Record<string, string> = {};
  for (const line of readFileSync(ENV_FILE, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m) env[m[1]] = m[2].replace(/^(["'])(.*)\1$/, "$2");
  }
  const missing = ["WC_SOURCE_URL", "WC_CONSUMER_KEY", "WC_CONSUMER_SECRET"].filter((k) => !env[k]);
  if (missing.length) throw new AccessError(`Missing in .env.local: ${missing.join(", ")}`);
  let base: URL;
  try {
    base = new URL(env.WC_SOURCE_URL);
  } catch {
    throw new AccessError("WC_SOURCE_URL is not a valid URL.");
  }
  if (base.protocol !== "https:") throw new AccessError("WC_SOURCE_URL must use https.");
  return { base, auth: "Basic " + Buffer.from(`${env.WC_CONSUMER_KEY}:${env.WC_CONSUMER_SECRET}`).toString("base64") };
}

// --- HTTP helpers ---------------------------------------------------------------------

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const TEMPORARY = new Set([408, 425, 429, 500, 502, 503, 504]);

/** Fetch with retries for temporary failures (network, 408/429/5xx). Never retries other statuses. */
async function fetchRetry(url: URL, init: RequestInit, attempts = 3): Promise<Response> {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url, { ...init, signal: AbortSignal.timeout(30_000) });
      if (!TEMPORARY.has(res.status) || i >= attempts) return res;
      await res.body?.cancel();
    } catch (error) {
      if (i >= attempts) throw error;
    }
    await sleep(1000 * 2 ** (i - 1));
  }
}

function makeApi({ base, auth }: { base: URL; auth: string }) {
  const prefix = base.pathname.replace(/\/$/, "") + "/wp-json/wc/v3";
  let calls = 0;
  async function get<T>(path: string): Promise<{ data: T; totalPages: number }> {
    const url = new URL(prefix + path, base.origin);
    calls++;
    // Credentials go in the header only (never in the URL), to the configured HTTPS origin only.
    const res = await fetchRetry(url, { headers: { Authorization: auth, Accept: "application/json" }, redirect: "error" });
    const text = await res.text();
    if (!res.ok) {
      let code = "";
      try {
        const body = JSON.parse(text) as { code?: string; message?: string };
        code = [body.code, body.message].filter(Boolean).join(": ").slice(0, 160);
      } catch {
        /* non-JSON error body: not echoed */
      }
      const where = path.split("?")[0];
      if (res.status === 401 || res.status === 403) throw new AccessError(`Access denied (HTTP ${res.status}) on ${where}${code ? ` — ${code}` : ""}. Check the API key permissions.`);
      throw new Error(`HTTP ${res.status} on ${where}${code ? ` — ${code}` : ""}`);
    }
    return { data: JSON.parse(text) as T, totalPages: Number(res.headers.get("x-wp-totalpages") ?? 1) || 1 };
  }
  async function all<T>(path: string): Promise<T[]> {
    const items: T[] = [];
    const sep = path.includes("?") ? "&" : "?";
    for (let page = 1; ; page++) {
      const { data, totalPages } = await get<T[]>(`${path}${sep}per_page=100&page=${page}`);
      items.push(...data);
      if (page >= totalPages || data.length === 0) return items;
    }
  }
  return { get, all, calls: () => calls };
}

// --- Images ---------------------------------------------------------------------------

type ImageKind = keyof typeof IMAGE_DIRS;
interface ImageResult { image?: ProductImage; error?: string; reused?: boolean }

/** Format + pixel size from the file header. Returns null for anything that is not an image. */
function sniffImage(b: Buffer): { ext: string; width?: number; height?: number } | null {
  if (b.length < 32) return null;
  if (b.readUInt32BE(0) === 0x89504e47) return { ext: "png", width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
  if (b.toString("ascii", 0, 4) === "GIF8") return { ext: "gif", width: b.readUInt16LE(6), height: b.readUInt16LE(8) };
  if (b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") {
    const chunk = b.toString("ascii", 12, 16);
    if (chunk === "VP8X") return { ext: "webp", width: 1 + b.readUIntLE(24, 3), height: 1 + b.readUIntLE(27, 3) };
    if (chunk === "VP8L") return { ext: "webp", width: 1 + (((b[22] & 0x3f) << 8) | b[21]), height: 1 + (((b[24] & 0xf) << 10) | (b[23] << 2) | ((b[22] & 0xc0) >> 6)) };
    if (chunk === "VP8 ") return { ext: "webp", width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
    return { ext: "webp" };
  }
  if (b[0] === 0xff && b[1] === 0xd8) {
    for (let i = 2; i + 9 < b.length; ) {
      if (b[i] !== 0xff) { i++; continue; }
      const marker = b[i + 1];
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { ext: "jpg", height: b.readUInt16BE(i + 5), width: b.readUInt16BE(i + 7) };
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
      i += 2 + b.readUInt16BE(i + 2);
    }
    return { ext: "jpg" };
  }
  if (b.toString("ascii", 4, 8) === "ftyp" && /avi[fs]/.test(b.toString("ascii", 8, 32))) {
    const at = b.indexOf("ispe");
    return at > 0 ? { ext: "avif", width: b.readUInt32BE(at + 8), height: b.readUInt32BE(at + 12) } : { ext: "avif" };
  }
  return null;
}

const safeName = (s: string) => slugify(decodeEntities(s)).slice(0, 60).replace(/-+$/, "") || "image";

function makeImages() {
  const existing: Record<ImageKind, Map<string, string>> = { products: new Map(), categories: new Map() };
  for (const kind of Object.keys(IMAGE_DIRS) as ImageKind[]) {
    mkdirSync(IMAGE_DIRS[kind], { recursive: true });
    for (const file of readdirSync(IMAGE_DIRS[kind])) {
      const key = /^(wc\d+|u[0-9a-f]+)-/.exec(file)?.[1];
      if (key) existing[kind].set(key, file);
    }
  }
  const cache = new Map<string, Promise<ImageResult>>();
  const used: Record<ImageKind, Set<string>> = { products: new Set(), categories: new Set() };
  const stats = { downloaded: 0, reused: 0, failed: [] as { kind: ImageKind; key: string; file: string; reason: string }[], fallbackSize: 0, mislabelled: [] as string[] };
  // Small promise pool: at most IMAGE_CONCURRENCY downloads at a time.
  let active = 0;
  const queue: (() => void)[] = [];
  const slot = async <T>(fn: () => Promise<T>): Promise<T> => {
    if (active >= IMAGE_CONCURRENCY) await new Promise<void>((r) => queue.push(r));
    active++;
    try {
      return await fn();
    } finally {
      active--;
      queue.shift()?.();
    }
  };

  const toImage = (kind: ImageKind, file: string, info: { width?: number; height?: number }, alt: string): ProductImage => {
    if (!info.width || !info.height) stats.fallbackSize++;
    return { src: `/images/${kind}/${file}`, alt, width: info.width || 1200, height: info.height || 1200 };
  };

  async function download(kind: ImageKind, source: WooImage, alt: string): Promise<ImageResult> {
    let url: URL;
    try {
      url = new URL(source.src);
    } catch {
      return { error: "invalid image URL" };
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") return { error: `unsupported protocol ${url.protocol}` };
    const key = source.id > 0 ? `wc${source.id}` : `u${Buffer.from(url.pathname).toString("hex").slice(-12)}`;
    const base = safeName(source.name || url.pathname.split("/").pop()!.replace(/\.[a-z0-9]+$/i, ""));

    // Rerun: keep a valid earlier download.
    const prior = existing[kind].get(key);
    if (prior) {
      const info = sniffImage(readFileSync(join(IMAGE_DIRS[kind], prior)));
      if (info) {
        used[kind].add(prior);
        stats.reused++;
        return { image: toImage(kind, prior, info, alt), reused: true };
      }
    }

    return slot(async () => {
      let res: Response;
      try {
        // No credentials, cookies or auth headers are ever sent to image hosts.
        res = await fetchRetry(url, { headers: { Accept: "image/avif,image/webp,image/png,image/jpeg,image/*" }, redirect: "follow", credentials: "omit" });
      } catch (error) {
        return { error: `network error (${(error as Error).name})` };
      }
      if (!res.ok) {
        await res.body?.cancel();
        return { error: res.status === 401 || res.status === 403 ? `access restricted (HTTP ${res.status}) — not bypassed` : `HTTP ${res.status}` };
      }
      const type = (res.headers.get("content-type") ?? "").split(";")[0].trim();
      if (/^(text\/html|application\/json)/.test(type)) {
        await res.body?.cancel();
        return { error: `not an image (content-type ${type})` };
      }
      if (Number(res.headers.get("content-length") ?? 0) > MAX_IMAGE_BYTES) {
        await res.body?.cancel();
        return { error: "larger than 15 MB" };
      }
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > MAX_IMAGE_BYTES) return { error: "larger than 15 MB" };
      const info = sniffImage(buf);
      // The file's own header is the real check; a wrong content-type alone is only noted.
      if (!info) return { error: `response is not a valid image file (content-type ${type || "missing"})` };
      if (!type.startsWith("image/")) stats.mislabelled.push(`${kind} image ${source.id}: served as ${type || "no content-type"}, file is ${info.ext}`);
      const file = `${key}-${base}.${info.ext}`;
      writeFileSync(join(IMAGE_DIRS[kind], file), buf);
      used[kind].add(file);
      stats.downloaded++;
      return { image: toImage(kind, file, info, alt) };
    });
  }

  /** Deduplicated by source image; failures are recorded and the record falls back to a placeholder. */
  async function get(kind: ImageKind, source: WooImage | null | undefined, alt: string, owner: string): Promise<ProductImage | undefined> {
    if (!source?.src) return undefined;
    const cacheKey = `${kind}:${source.id || source.src}`;
    if (!cache.has(cacheKey)) cache.set(cacheKey, download(kind, source, alt));
    const result = await cache.get(cacheKey)!;
    if (result.error) {
      stats.failed.push({ kind, key: owner, file: `${source.id || "?"} ${safeName(source.name ?? "")}`, reason: result.error });
      return undefined;
    }
    // Same file, but alt text belongs to this record.
    return { ...result.image!, alt };
  }

  const unreferenced = () =>
    (Object.keys(IMAGE_DIRS) as ImageKind[]).flatMap((kind) => readdirSync(IMAGE_DIRS[kind]).filter((f) => !f.startsWith(".") && !used[kind].has(f)).map((f) => `${kind}/${f}`));

  return { get, stats, unreferenced };
}

// --- Mapping helpers --------------------------------------------------------------------

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SKU = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const GTIN = /^(\d{8}|\d{12,14})$/;

const text = (html: string | null | undefined) => htmlToText(html);
const name = (s: string) => decodeEntities(s).replace(/\s+/g, " ").trim();
const num = (s: string | number | null | undefined) => {
  const n = typeof s === "number" ? s : parseFloat(String(s ?? "").trim());
  return Number.isFinite(n) ? n : undefined;
};
const date = (s: string | null | undefined) => (s && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : undefined);
const stockStatus = (s: string): StockStatus => (s === "outofstock" ? "out_of_stock" : s === "onbackorder" ? "backorder" : "in_stock");
const backorders = (s: string): BackorderPolicy => (s === "yes" ? "allow" : s === "notify" ? "notify" : "no");
const taxStatus = (s: string): TaxStatus => (s === "shipping" ? "shipping" : s === "none" ? "none" : "taxable");
const TAX_CLASSES: Record<string, TaxClass> = { "": "standard", standard: "standard", "reduced-rate": "reduced" };
const VISIBILITY: Record<string, ProductVisibility> = { visible: "visible", catalog: "catalog", search: "search", hidden: "hidden" };

function dimensions(d: WooDimensions | undefined, unit: string): Dimensions | undefined {
  const [length, width, height] = [num(d?.length), num(d?.width), num(d?.height)];
  if (!(length && width && height) || !["cm", "mm", "m"].includes(unit)) return undefined;
  return { length, width, height, unit: unit as Dimensions["unit"] };
}

/** Unique slug: keeps the source slug when valid and free, otherwise derives one. */
function uniqueSlug(source: string, fallback: string, taken: Set<string>) {
  let base = decodeURIComponent(source || "").toLowerCase();
  if (!SLUG.test(base)) base = slugify(fallback) || "item";
  let slug = base;
  for (let i = 2; taken.has(slug); i++) slug = `${base}-wc${i === 2 ? "" : i}`;
  taken.add(slug);
  return slug;
}

// --- Main -------------------------------------------------------------------------------

async function main() {
  const started = Date.now();
  const api = makeApi(readEnv());
  const importedAt = new Date().toISOString();
  console.log(`WooCommerce catalog import — limit ${LIMIT} parent products`);

  // Store settings: currency and units (read-only).
  const general = (await api.get<{ id: string; value: unknown }[]>("/settings/general")).data;
  const productSettings = (await api.get<{ id: string; value: unknown }[]>("/settings/products")).data;
  const setting = (list: { id: string; value: unknown }[], id: string) => String(list.find((s) => s.id === id)?.value ?? "");
  const currency = setting(general, "woocommerce_currency") || "UNKNOWN";
  const weightUnit = setting(productSettings, "woocommerce_weight_unit") || "UNKNOWN";
  const dimensionUnit = setting(productSettings, "woocommerce_dimension_unit") || "UNKNOWN";
  const copyPrices = currency === STORE_CURRENCY;
  console.log(`Source currency ${currency}, weight ${weightUnit}, dimensions ${dimensionUnit}${copyPrices ? "" : " — prices kept as source metadata only"}`);

  const [wooCategories, wooProducts, shippingClasses] = await Promise.all([
    api.all<WooCategory>("/products/categories"),
    api.all<WooProduct>("/products?status=publish&orderby=id&order=asc"),
    api.all<WooTerm>("/products/shipping_classes"),
  ]);
  console.log(`Fetched ${wooCategories.length} categories, ${wooProducts.length} published products`);

  // --- Selection: earlier imports first, then greedy category coverage, then round-robin fill.
  const previous: Fixture | undefined = existsSync(FIXTURE) ? JSON.parse(readFileSync(FIXTURE, "utf8")) : undefined;
  const previousIds = new Set((previous?.products ?? []).map((p) => p.legacyWooId!).filter(Boolean));
  const eligible = wooProducts.filter((p) => p.type === "simple" || p.type === "variable");
  const skippedTypes = wooProducts.filter((p) => !eligible.includes(p)).map((p) => `${p.id} (${p.type})`);
  const selected: WooProduct[] = [];
  const covered = new Map<number, number>();
  const take = (p: WooProduct) => {
    selected.push(p);
    for (const c of p.categories) covered.set(c.id, (covered.get(c.id) ?? 0) + 1);
  };
  eligible.filter((p) => previousIds.has(p.id)).forEach(take);
  const droppedPrevious = [...previousIds].filter((id) => !selected.some((p) => p.id === id));
  while (selected.length < LIMIT) {
    let best: WooProduct | undefined;
    let bestScore = 0;
    for (const p of eligible) {
      if (selected.includes(p)) continue;
      const gain = p.categories.filter((c) => !covered.has(c.id)).length;
      const score = gain * 10 + (p.type === "variable" ? 5 : 0) + (p.images.length ? 1 : 0);
      if (gain > 0 && score > bestScore) [best, bestScore] = [p, score];
    }
    if (!best) break;
    take(best);
  }
  while (selected.length < LIMIT) {
    const pool = eligible.filter((p) => !selected.includes(p));
    if (!pool.length) break;
    const weight = (p: WooProduct) => Math.min(...p.categories.map((c) => covered.get(c.id) ?? 0), 99) * 10 - (p.images.length ? 1 : 0) - (p.type === "variable" ? 2 : 0);
    take(pool.sort((a, b) => weight(a) - weight(b) || a.id - b.id)[0]);
  }
  selected.sort((a, b) => a.id - b.id);
  const selectedIds = new Set(selected.map((p) => p.id));

  // Variations of selected variable products (all of them, paginated).
  const variationsByParent = new Map<number, WooVariation[]>();
  for (const p of selected.filter((x) => x.type === "variable")) {
    variationsByParent.set(p.id, await api.all<WooVariation>(`/products/${p.id}/variations?orderby=id&order=asc`));
  }

  // --- Demo records: avoid slug/SKU clashes with the hand-written mock catalog.
  const demoSource = readFileSync(DEMO_CATALOG, "utf8");
  const takenProductSlugs = new Set<string>();
  const takenCategorySlugs = new Set<string>();
  const demoSkus = new Set([...demoSource.matchAll(/\bsku: "([^"]+)"/g)].map((m) => m[1].toLowerCase()));
  // Demo categories are declared before `const updatedAt`; everything after is products/brands/tags.
  const [demoCategoryPart, demoRest] = demoSource.split("const updatedAt");
  for (const m of demoCategoryPart.matchAll(/\bslug: "([^"]+)"/g)) takenCategorySlugs.add(m[1]);
  for (const m of (demoRest ?? "").matchAll(/\bslug: "([^"]+)"/g)) takenProductSlugs.add(m[1]);

  const images = makeImages();
  const report = {
    generatedSku: [] as number[],
    noWeight: [] as number[],
    noImage: [] as number[],
    longShort: [] as number[],
    longDescription: [] as number[],
    slugChanged: [] as string[],
    unmappedTax: new Map<string, number[]>(),
    unmappedShipping: new Map<string, number[]>(),
    droppedLinks: 0,
    globalAttributes: new Set<string>(),
    meta: new Map<string, number>(),
  };
  const push = (map: Map<string, number[]>, key: string, id: number) => map.set(key, [...(map.get(key) ?? []), id]);

  // --- Categories (all, hierarchy preserved).
  const catId = (id: number) => `wc-cat-${id}`;
  const knownCategories = new Set(wooCategories.map((c) => c.id));
  const categories: Category[] = await Promise.all(
    [...wooCategories].sort((a, b) => a.id - b.id).map(async (c): Promise<Category> => {
      const catName = name(c.name);
      const slug = uniqueSlug(c.slug, catName, takenCategorySlugs);
      if (slug !== c.slug) report.slugChanged.push(`category ${c.id}: ${c.slug} → ${slug}`);
      return {
        id: catId(c.id),
        legacyWooId: c.id,
        slug,
        name: catName,
        description: text(c.description) || undefined,
        parentId: c.parent && knownCategories.has(c.parent) ? catId(c.parent) : undefined,
        status: "active",
        image: await images.get("categories", c.image, catName, `category ${c.id}`),
      };
    }),
  );

  // --- Brands & tags referenced by the selected products.
  const brands = new Map<number, Brand>();
  const tags = new Map<number, Tag>();
  for (const p of selected) {
    for (const b of p.brands ?? []) brands.set(b.id, { id: `wc-brand-${b.id}`, legacyWooId: b.id, slug: b.slug, name: name(b.name) });
    for (const t of p.tags) tags.set(t.id, { id: `wc-tag-${t.id}`, legacyWooId: t.id, slug: t.slug, name: name(t.name) });
  }

  // --- Products.
  const takenSkus = new Set(demoSkus);
  const skuFor = (source: string, fallback: string) => {
    const s = source.trim();
    if (s && SKU.test(s) && s.length <= LIMITS.sku && !takenSkus.has(s.toLowerCase())) {
      takenSkus.add(s.toLowerCase());
      return { sku: s };
    }
    let sku = fallback;
    for (let i = 2; takenSkus.has(sku.toLowerCase()); i++) sku = `${fallback}-${i}`;
    takenSkus.add(sku.toLowerCase());
    return { sku, sourceSku: s };
  };
  const shippingSlugs = new Set(shippingClasses.map((s) => s.slug));
  const mapTax = (raw: string, id: number): { taxClass: TaxClass; unmapped?: string } => {
    if (raw in TAX_CLASSES) return { taxClass: TAX_CLASSES[raw] };
    push(report.unmappedTax, raw, id);
    return { taxClass: "standard", unmapped: raw };
  };
  const mapShipping = (raw: string, id: number) => {
    if (!raw) return undefined;
    push(report.unmappedShipping, raw + (shippingSlugs.has(raw) ? "" : " (not in source shipping classes)"), id);
    return raw;
  };
  const prices = (w: WooCommon) => {
    const regular = w.regular_price?.trim() || undefined;
    const sale = w.sale_price?.trim() || undefined;
    const from = date(w.date_on_sale_from);
    const to = date(w.date_on_sale_to);
    return {
      source: { regularPrice: regular, salePrice: sale, saleFrom: from, saleTo: to },
      // Only same-currency amounts become store prices; nothing is converted or relabelled.
      store: copyPrices ? { basePrice: num(regular), salePrice: num(sale), saleFrom: sale ? from : undefined, saleTo: sale ? to : undefined } : {},
    };
  };

  const products: Product[] = [];
  for (const w of selected) {
    for (const key of new Set((w.meta_data ?? []).map((m) => m.key))) report.meta.set(key, (report.meta.get(key) ?? 0) + 1);
    const productName = name(w.name);
    const id = `wc-${w.id}`;
    const slug = uniqueSlug(w.slug, `${productName}-${w.id}`, takenProductSlugs);
    if (slug !== w.slug) report.slugChanged.push(`product ${w.id}: ${w.slug} → ${slug}`);
    const { sku, sourceSku } = skuFor(w.sku, `WC-${w.id}`);
    if (sourceSku !== undefined) report.generatedSku.push(w.id);
    const weight = num(w.weight);
    if (!weight) report.noWeight.push(w.id);
    const tax = mapTax(w.tax_class, w.id);
    const shipping = mapShipping(w.shipping_class, w.id);
    const price = prices(w);

    const productImages = (
      await Promise.all(w.images.map((img, i) => images.get("products", img, i === 0 ? productName : `${productName} — image ${i + 1}`, `product ${w.id}`)))
    ).filter((x): x is ProductImage => Boolean(x));
    if (!productImages.length) report.noImage.push(w.id);

    const shortDescription = text(w.short_description);
    const description = sanitizeHtml(w.description);
    if (shortDescription.length > LIMITS.shortDescription) report.longShort.push(w.id);
    if (description.length > LIMITS.description) report.longDescription.push(w.id);

    const attributes: ProductAttribute[] = w.attributes.map((a) => {
      if (a.id > 0) report.globalAttributes.add(name(a.name));
      return { name: name(a.name), values: (a.options ?? []).map(name), visible: a.visible ?? true, variation: w.type === "variable" && Boolean(a.variation) };
    });
    const links = (ids: number[]) => {
      const kept = ids.filter((x) => selectedIds.has(x));
      report.droppedLinks += ids.length - kept.length;
      return kept.map((x) => `wc-${x}`);
    };

    const parentStock = { status: stockStatus(w.stock_status), ...(w.manage_stock === true ? { quantity: w.stock_quantity ?? 0 } : {}) };
    const variations: ProductVariation[] = [];
    for (const v of variationsByParent.get(w.id) ?? []) {
      const vPrice = prices(v);
      const vSku = skuFor(v.sku, `WC-${w.id}-${v.id}`);
      const vTax = v.tax_class === "parent" ? undefined : mapTax(v.tax_class, v.id);
      const vWeight = num(v.weight);
      const label = v.attributes.map((a) => name(a.option ?? "")).join(" ");
      variations.push({
        id: `wc-${w.id}-v${v.id}`,
        legacyWooId: v.id,
        sku: vSku.sku,
        gtin: v.global_unique_id && GTIN.test(v.global_unique_id) ? v.global_unique_id : undefined,
        attributes: Object.fromEntries(v.attributes.map((a) => [name(a.name), name(a.option ?? "")])),
        status: v.status === "publish" ? "active" : "disabled",
        ...vPrice.store,
        image: await images.get("products", v.image, `${productName} — ${label}`, `variation ${v.id}`),
        gallery: [],
        description: text(v.description) || undefined,
        stockMode: v.manage_stock === "parent" ? "parent" : v.manage_stock ? "track" : "status",
        stock: v.manage_stock === "parent" ? parentStock : { status: stockStatus(v.stock_status), ...(v.manage_stock ? { quantity: v.stock_quantity ?? 0 } : {}) },
        backorders: backorders(v.backorders),
        weight: vWeight ? { value: vWeight, unit: weightUnit === "g" ? "g" : "kg" } : undefined,
        dimensions: dimensions(v.dimensions, dimensionUnit),
        taxClass: vTax?.taxClass,
        importSource: { ...vPrice.source, sourceSku: vSku.sourceSku },
      });
      mapShipping(v.shipping_class, v.id);
    }

    const importSource: ImportSource = {
      system: "woocommerce",
      importedAt,
      currency,
      ...price.source,
      weightUnit,
      dimensionUnit,
      sourceSku,
      unmappedTaxClass: tax.unmapped,
      unmappedShippingClass: shipping,
    };
    products.push({
      id,
      legacyWooId: w.id,
      type: w.type === "variable" ? "variable" : "simple",
      slug,
      sku,
      gtin: w.global_unique_id && GTIN.test(w.global_unique_id) ? w.global_unique_id : undefined,
      name: productName,
      shortDescription,
      description,
      status: "published",
      visibility: VISIBILITY[w.catalog_visibility] ?? "visible",
      featured: w.featured,
      categoryIds: w.categories.filter((c) => knownCategories.has(c.id)).map((c) => catId(c.id)),
      tagIds: w.tags.map((t) => `wc-tag-${t.id}`),
      brandIds: (w.brands ?? []).map((b) => `wc-brand-${b.id}`),
      images: productImages,
      // Source has no selling-unit field; "item" is a neutral default to set per product.
      unitLabel: "item",
      ...(w.type === "variable" ? {} : price.store),
      taxStatus: taxStatus(w.tax_status),
      taxClass: tax.taxClass,
      manageStock: w.manage_stock === true,
      stock: parentStock,
      backorders: backorders(w.backorders),
      lowStockThreshold: num(w.low_stock_amount),
      soldIndividually: w.sold_individually,
      weight: { value: weight ?? 0, unit: weightUnit === "g" ? "g" : "kg" },
      dimensions: dimensions(w.dimensions, dimensionUnit),
      quantityRule: { min: 1, step: 1 },
      isVariableWeight: false,
      attributes,
      defaultAttributes: Object.fromEntries(w.default_attributes.map((a) => [name(a.name), name(a.option ?? "")])),
      variations,
      upsellIds: links(w.upsell_ids),
      crossSellIds: links(w.cross_sell_ids),
      purchaseNote: text(w.purchase_note) || undefined,
      menuOrder: w.menu_order ?? 0,
      reviewsEnabled: w.reviews_allowed,
      updatedAt: w.date_modified_gmt ? `${w.date_modified_gmt}Z` : importedAt,
      importSource,
    });
  }

  // Strip undefined keys so the fixture stays small and diff-friendly.
  const fixture: Fixture = JSON.parse(
    JSON.stringify({
      meta: {
        source: "woocommerce",
        note: "Development fixture generated by scripts/import-woocommerce.ts. Do not edit by hand; rerun the import.",
        importedAt,
        currency,
        storeCurrency: STORE_CURRENCY,
        pricesCopied: copyPrices,
        weightUnit,
        dimensionUnit,
        sourcePublishedProducts: wooProducts.length,
      },
      categories,
      brands: [...brands.values()].sort((a, b) => a.legacyWooId! - b.legacyWooId!),
      tags: [...tags.values()].sort((a, b) => a.legacyWooId! - b.legacyWooId!),
      products,
    }),
  );
  mkdirSync(dirname(FIXTURE), { recursive: true });
  writeFileSync(FIXTURE, JSON.stringify(fixture, null, 2) + "\n");

  // --- Report (no credentials, hosts or URLs).
  const variationCount = products.reduce((s, p) => s + p.variations.length, 0);
  const typeCount = (t: string) => products.filter((p) => p.type === t).length;
  const leafCovered = new Set(products.flatMap((p) => p.categoryIds));
  const list = (ids: (number | string)[]) => (ids.length ? ids.join(", ") : "none");
  const STANDARD_FIELDS = "id, name, slug, type, status, featured, catalog_visibility, description, short_description, sku, global_unique_id, regular_price, sale_price, date_on_sale_*, tax_status, tax_class, manage_stock, stock_quantity, stock_status, backorders, low_stock_amount, sold_individually, weight, dimensions, shipping_class, reviews_allowed, upsell_ids, cross_sell_ids, purchase_note, categories, tags, brands, images, attributes, default_attributes, variations, menu_order, date_modified_gmt";
  const md = `# WooCommerce import report

Generated by \`npm run import:woocommerce\` on ${importedAt.slice(0, 19).replace("T", " ")} UTC. Development data only — WordPress is a
temporary import source; the app and builds read the saved fixture and local images.

## Source settings

| Setting | Value |
| --- | --- |
| Currency | ${currency} |
| Weight unit | ${weightUnit} |
| Dimension unit | ${dimensionUnit} |
| Store currency (this app) | ${STORE_CURRENCY} |

${copyPrices ? "Source and store currency match: regular/sale prices were copied to the product prices." : `Source currency (${currency}) differs from the store currency (${STORE_CURRENCY}). Source prices are kept in \`importSource\` only — **not converted, not relabelled**. Imported products have no store price, so they cannot be ordered until BDT prices are entered (they still show in catalog previews).`}

## Counts

| Item | Count |
| --- | --- |
| Published products in source | ${wooProducts.length}${skippedTypes.length ? ` (${skippedTypes.length} grouped/external skipped: ${list(skippedTypes)})` : ""} |
| Imported parent products | ${products.length} (simple ${typeCount("simple")}, variable ${typeCount("variable")}) |
| Imported variations | ${variationCount} |
| Categories (all, hierarchy kept) | ${categories.length} (${categories.filter((c) => !c.parentId).length} top level) — ${leafCovered.size} used by imported products |
| Brands / tags referenced | ${brands.size} / ${tags.size} |
| Images downloaded this run | ${images.stats.downloaded} |
| Images reused from an earlier run | ${images.stats.reused} |
| Image download failures | ${images.stats.failed.length} |
| API requests | ${api.calls()} |

Selection: products imported earlier stay selected while published; the rest are picked to cover as many categories as
possible, then filled round-robin across the least-covered categories (deterministic, by source ID).
${droppedPrevious.length ? `\nPreviously imported but no longer published in the source (removed from the fixture): ${list(droppedPrevious)}\n` : ""}
## Failed image downloads

${images.stats.failed.length ? images.stats.failed.map((f) => `- ${f.key} — image ${f.file}: ${f.reason}`).join("\n") : "None."}
${images.stats.mislabelled.length ? `\nAccepted with a wrong content-type (file header verified as an image):\n${images.stats.mislabelled.map((m) => `- ${m}`).join("\n")}\n` : ""}${images.stats.fallbackSize ? `\n${images.stats.fallbackSize} image(s) had no readable pixel size; 1200×1200 is recorded instead.\n` : ""}
## Missing or adjusted data (source IDs)

- **No SKU in source → generated \`WC-<id>\`** (original kept in \`importSource.sourceSku\`): ${report.generatedSku.length} — ${list(report.generatedSku)}
- **No weight in source → recorded as 0** (set before editing; the product form requires a weight): ${list(report.noWeight)}
- **No usable image → storefront placeholder**: ${list(report.noImage)}
- **Short description longer than ${LIMITS.shortDescription} characters** (kept in full; the admin form will ask to shorten it on save): ${list(report.longShort)}
- **Description longer than ${LIMITS.description.toLocaleString("en")} characters**: ${list(report.longDescription)}
- **Slugs changed** (invalid or clashing with demo records): ${report.slugChanged.length ? report.slugChanged.join("; ") : "none"}
- **Selling unit**: the source has no selling-unit field; every product gets the neutral default \`item\`.
- **Image alt text**: set from the product/category name (source alt text not copied).
- **Linked products** (upsell/cross-sell) pointing outside the imported selection: ${report.droppedLinks} link(s) dropped.

## Tax and shipping classes

- Mapped: source \`""\` (standard) → \`standard\`, \`reduced-rate\` → \`reduced\`.
- Unresolved tax classes (kept in \`importSource.unmappedTaxClass\`, product set to \`standard\`): ${report.unmappedTax.size ? [...report.unmappedTax].map(([k, ids]) => `\`${k}\` on ${list(ids)}`).join("; ") : "none"}. \`zero-rate\` is not mapped to \`exempt\` automatically — zero-rated and exempt are different tax treatments; confirm before mapping.
- Source shipping classes: ${shippingClasses.length}. Unresolved shipping classes on imported products: ${report.unmappedShipping.size ? [...report.unmappedShipping].map(([k, ids]) => `\`${k}\` on ${list(ids)}`).join("; ") : "none"}.

## Unsupported or plugin-specific fields (not imported)

Standard fields read: ${STANDARD_FIELDS}.

Not imported: \`permalink\`, \`price_html\`, \`total_sales\`, ratings, \`virtual\`/\`downloadable\`/downloads, \`external_url\`/\`button_text\`,
\`post_password\`, \`related_ids\`; category \`display\` and \`menu_order\`.
${report.globalAttributes.size ? `\nGlobal (store-wide) attributes used on imported products are stored as product-level attributes without a store-wide link: ${[...report.globalAttributes].join(", ")}.\n` : ""}
Meta keys on imported products (plugin data — meaning not assumed, not imported):

| Meta key | Products |
| --- | --- |
${[...report.meta].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([k, n]) => `| \`${k}\` | ${n} |`).join("\n") || "| none | 0 |"}

## Needs confirmation

- Whether the "Country Wise" sub-categories should set each product's country of origin (\`originCountry\` is left empty).
- Whether any products are sold by variable weight (\`isVariableWeight\` is left \`false\`).
- Store prices in ${STORE_CURRENCY}${copyPrices ? "" : ` (source prices are ${currency})`}.

## Local files

- Fixture: \`src/lib/data/fixtures/woocommerce-catalog.json\`
- Images: \`public/images/products/\`, \`public/images/categories/\`
${images.unreferenced().length ? `- Unreferenced image files left in place (from earlier runs): ${images.unreferenced().length}\n` : ""}`;
  writeFileSync(REPORT, md);

  console.log(`Imported ${products.length} products (${variationCount} variations), ${categories.length} categories, ${brands.size} brands, ${tags.size} tags`);
  console.log(`Images: ${images.stats.downloaded} downloaded, ${images.stats.reused} reused, ${images.stats.failed.length} failed`);
  console.log(`Wrote ${FIXTURE.replace(ROOT, ".")} and ${REPORT.replace(ROOT, ".")} in ${((Date.now() - started) / 1000).toFixed(1)}s`);
}

main().catch((error: unknown) => {
  // Messages never contain credentials (they are only ever placed in a request header).
  console.error(error instanceof AccessError ? `Import stopped: ${error.message}` : `Import failed: ${(error as Error).message}`);
  process.exit(1);
});

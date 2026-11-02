import "server-only";

import { CART_LIMITS, NO_PRICE_ERROR, cartLineId, checkCartLine, mergeCartLines } from "@/lib/orders/cart";
import { fromMinor, toMinor } from "@/lib/orders/calc";
import { lineStock } from "@/lib/orders/stock";
import { tierLabel } from "@/lib/pricing/engine";
import type { Cart, CartLine, CartLineInput, Customer, ID, QuickOrderLine } from "@/lib/types";
import { mockProductRepository } from "./mock-catalog";
import { mockProducts } from "./mock/catalog";
import { mockCustomers } from "./mock/customers";
import { quantityLimitsFor, quotePrice } from "./mock/pricing-rules";
import type { CartRepository, SaveResult } from "./repositories";

/*
 * DEMO STORE: carts live in memory on globalThis, one per customer — they survive page refreshes but not a server
 * restart. Only product, option and quantity are stored; prices are resolved on every read, so a rule or sale change
 * shows up in the cart immediately. The backend keeps carts in its database.
 */
const store = globalThis as typeof globalThis & { __mockCarts?: Map<ID, { lines: CartLineInput[]; updatedAt: string }> };
store.__mockCarts ??= new Map();
const carts = store.__mockCarts;

export const cartLines = (customerId: ID): CartLineInput[] => structuredClone(carts.get(customerId)?.lines ?? []);
export const clearCart = (customerId: ID) => void carts.delete(customerId);

const approved = (customerId: ID) => mockCustomers.find((c) => c.id === customerId && c.status === "approved");
const notAllowed = { ok: false as const, errors: {}, message: "Only approved business customers can use the cart." };

/** Products per quick order page (each may add several option lines). */
export const QUICK_ORDER_PRODUCTS_PER_PAGE = 20;

/** Who prices quick order lines when the viewer may not see prices (prices are then removed before returning). */
const NO_PRICE_VIEWER = { id: "no-price-viewer", status: "pending" as const };

/** A stored line priced and checked for the customer. Also used by checkout. */
export function priceCartLine(customer: Pick<Customer, "id" | "groupId" | "status">, line: CartLineInput): CartLine {
  const product = mockProducts.find((p) => p.id === line.productId);
  const id = cartLineId(line.productId, line.variationId);
  if (!product) {
    return { ...line, id, slug: "", name: "Removed product", sku: "", unitLabel: "", pricedByWeight: false, stockStatus: "out_of_stock", minQuantity: 1, step: 1, error: "This product is no longer available." };
  }
  const variation = product.variations.find((v) => v.id === line.variationId);
  const stock = lineStock(product, line.variationId)!;
  const limits = quantityLimitsFor(product, line.variationId);
  const step = variation?.quantityRule?.step ?? product.quantityRule.step;
  const quote = quotePrice(product, customer, line.variationId, line.quantity);
  const unitPrice = quote?.unitPrice;
  const error = checkCartLine({
    quantity: line.quantity,
    min: limits.min,
    max: limits.max,
    step,
    stock: stock.stock,
    stockMode: stock.mode,
    backorders: variation?.backorders ?? product.backorders,
    priced: unitPrice !== undefined,
    unavailable: stock.unavailable ?? (product.status !== "published" ? "This product is not available." : undefined),
  });
  const priceNote = quote?.tier ? tierLabel(quote.tier) : quote?.priceSource === "sale" ? "Sale price" : quote?.rule ? "Your price" : undefined;
  return {
    ...line,
    id,
    slug: product.slug,
    name: product.name,
    sku: variation?.sku ?? product.sku,
    variationLabel: variation ? Object.entries(variation.attributes).map(([k, v]) => `${k}: ${v}`).join(", ") : undefined,
    image: variation?.image ?? product.images[0],
    unitLabel: product.unitLabel,
    pricedByWeight: product.isVariableWeight,
    stockStatus: stock.stock.status,
    unitPrice,
    lineTotal: unitPrice === undefined ? undefined : fromMinor(toMinor(unitPrice) * line.quantity),
    priceNote,
    minQuantity: limits.min,
    maxQuantity: limits.max,
    step,
    error,
  };
}

function view(customer: Customer): Cart {
  const stored = carts.get(customer.id);
  const lines = (stored?.lines ?? []).map((l) => priceCartLine(customer, l));
  const subtotal = lines.reduce((sum, l) => sum + (l.lineTotal === undefined ? 0 : toMinor(l.lineTotal)), 0);
  return { customerId: customer.id, lines, itemsSubtotal: fromMinor(subtotal), valid: lines.length > 0 && lines.every((l) => !l.error), updatedAt: stored?.updatedAt };
}

function save(customer: Customer, lines: CartLineInput[]) {
  if (lines.length) carts.set(customer.id, { lines, updatedAt: new Date().toISOString() });
  else carts.delete(customer.id);
  return view(customer);
}

export const mockCartRepository: CartRepository = {
  async get(customerId) {
    const customer = approved(customerId);
    return customer ? view(customer) : { customerId, lines: [], itemsSubtotal: 0, valid: false };
  },

  async add(customerId, lines) {
    const customer = approved(customerId);
    if (!customer) return notAllowed;
    const skipped: string[] = [];
    const accepted: CartLineInput[] = [];
    for (const line of lines) {
      const product = mockProducts.find((p) => p.id === line.productId && p.status === "published");
      if (!product) {
        skipped.push("A product is no longer available.");
        continue;
      }
      const variation = product.variations.find((v) => v.id === line.variationId);
      if (product.type === "variable" ? !variation || variation.status !== "active" : line.variationId) {
        skipped.push(`${product.name}: choose an available option.`);
        continue;
      }
      if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > CART_LIMITS.quantity) {
        skipped.push(`${product.name}: enter a whole quantity of at least 1.`);
        continue;
      }
      if (!quotePrice(product, customer, line.variationId, line.quantity)) {
        skipped.push(`${product.name}: no price yet, can't be ordered online.`);
        continue;
      }
      accepted.push({ productId: product.id, variationId: variation?.id, quantity: line.quantity });
    }
    const merged = mergeCartLines(carts.get(customerId)?.lines ?? [], accepted);
    if (merged.length > CART_LIMITS.lines) return { ok: false, errors: {}, message: `A cart can hold up to ${CART_LIMITS.lines} products.` };
    if (!accepted.length) return { ok: false, errors: {}, message: skipped[0] ?? "Nothing was added." };
    return { ok: true, value: { cart: save(customer, merged), added: accepted.length, skipped } };
  },

  async setQuantity(customerId, lineId, quantity) {
    const customer = approved(customerId);
    if (!customer) return notAllowed;
    const current = carts.get(customerId)?.lines ?? [];
    if (!current.some((l) => cartLineId(l.productId, l.variationId) === lineId)) return { ok: false, errors: {}, message: "This item is no longer in your cart." };
    if (!Number.isInteger(quantity) || quantity < 0 || quantity > CART_LIMITS.quantity) return { ok: false, errors: { quantity: "Enter a whole number." }, message: "Enter a whole number." };
    const lines = current
      .map((l) => (cartLineId(l.productId, l.variationId) === lineId ? { ...l, quantity } : l))
      .filter((l) => l.quantity > 0);
    return { ok: true, value: save(customer, lines) } satisfies SaveResult<Cart>;
  },

  async quickOrder(customerId, { search, categorySlug, productIds, page = 1 } = {}) {
    const customer = customerId ? approved(customerId) : undefined;
    const result = await mockProductRepository.list({
      search: search?.trim() || undefined,
      categorySlug: categorySlug || undefined,
      productIds,
      sort: "name",
      dir: "asc",
      page,
      perPage: QUICK_ORDER_PRODUCTS_PER_PAGE,
    });
    const lines = result.items.flatMap((summary) => {
      const product = mockProducts.find((p) => p.id === summary.id);
      if (!product) return [];
      const variationIds = product.type === "variable" ? product.variations.filter((v) => v.status === "active").map((v) => v.id) : [undefined];
      return variationIds.map((variationId): QuickOrderLine => {
        const priced = priceCartLine(customer ?? NO_PRICE_VIEWER, {
          productId: product.id,
          variationId,
          quantity: quantityLimitsFor(product, variationId).min,
        });
        const line: QuickOrderLine = { ...priced };
        delete (line as Partial<CartLine>).quantity;
        delete (line as Partial<CartLine>).lineTotal;
        if (customer) return line;
        // Not an approved customer: never send wholesale prices. Stock and availability errors still apply.
        const priceError = line.unitPrice === undefined && line.error === NO_PRICE_ERROR;
        return { ...line, unitPrice: undefined, priceNote: undefined, error: priceError ? undefined : line.error };
      });
    });
    return { lines, page: result.page, totalPages: result.totalPages, totalProducts: result.total };
  },

  async remove(customerId, lineId) {
    const customer = approved(customerId);
    if (!customer) return notAllowed;
    const lines = (carts.get(customerId)?.lines ?? []).filter((l) => cartLineId(l.productId, l.variationId) !== lineId);
    return { ok: true, value: save(customer, lines) };
  },
};

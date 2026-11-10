import "server-only";

import type { CardAction } from "@/components/product/product-card";
import type { PriceAccess } from "@/components/shop/filter-sidebar";
import { canSeeWholesalePrices, getViewer, type Viewer } from "@/lib/auth/session";
import { repositories } from "@/lib/data";
import { STANDARD_PRICING_ID } from "@/lib/pricing/standard";
import type { ProductSummary } from "@/lib/types";

export const priceAccessOf = (viewer: Viewer): PriceAccess =>
  viewer.kind === "admin" ? "admin" : viewer.kind === "customer" ? (canSeeWholesalePrices(viewer) ? "approved" : "pending") : "guest";

/** Prices and the round + action for a page of product cards, resolved on the server for the current viewer only. */
export async function loadCardData(items: ProductSummary[], viewer: Viewer) {
  const access = priceAccessOf(viewer);
  // Staff see the standard wholesale price; approved customers their own.
  const customerId = access === "approved" && viewer.kind === "customer" ? viewer.customerId : access === "admin" ? STANDARD_PRICING_ID : null;
  const ids = items.map((p) => p.id);
  const [prices, orderLines] = customerId && ids.length
    ? await Promise.all([repositories.pricing.getCustomerPrices(customerId, ids), repositories.cart.quickOrder(customerId, { productIds: ids }).then((r) => r.lines)])
    : [[], []];
  const priceFor = (id: string) => prices.find((p) => p.productId === id)?.unitPrice;
  // Same rules as the quick order sheet (minimum quantity, stock, price, quantity rules).
  const actionFor = (product: ProductSummary): CardAction => {
    if (access === "guest") return { kind: "link", href: "/login", label: "Log in to order" };
    if (access === "pending") return { kind: "disabled", label: "Available once your account is approved" };
    if (product.hasVariations) return { kind: "link", href: `/shop/${product.slug}`, label: access === "admin" ? "See options and prices" : "Choose options" };
    const line = orderLines.find((l) => l.productId === product.id);
    if (!line) return { kind: "disabled", label: "Not available to order" };
    // Staff don't have a cart: they place orders for a customer in the admin.
    if (access === "admin") return line.error ? { kind: "disabled", label: line.error } : { kind: "link", href: "/admin/orders/new", label: "Create an order for a customer" };
    return line.error ? { kind: "disabled", label: line.error } : { kind: "add", quantity: line.minQuantity, max: line.maxQuantity, step: line.step };
  };
  return { access, priceFor, actionFor };
}

/** Products flagged as featured, for the homepage. */
export async function loadFeaturedProducts(max: number) {
  const viewer = await getViewer();
  const { items } = await repositories.products.list({ featured: true, perPage: max });
  const { access, priceFor, actionFor } = await loadCardData(items, viewer);
  return { access, cards: items.map((product) => ({ product, price: priceFor(product.id), action: actionFor(product) })) };
}

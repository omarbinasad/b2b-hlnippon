/**
 * Current catalog stock for an order line (pure; tested in tests/order-editing.test.ts).
 * Orders keep snapshots, so this is read live from the product and never stored on the order.
 */
import type { ID, Product, StockInfo, StockMovementSource, StockStatus } from "@/lib/types";

export interface LineStock {
  stock: StockInfo;
  /** "quantity" = counted stock (status follows the quantity); "status" = a chosen in/out of stock status. */
  mode: "quantity" | "status";
  /** The variation uses the product's shared stock, so a change affects every option sharing it. */
  shared: boolean;
  /** Why the line can't be restocked from the order (archived product, removed or disabled option). */
  unavailable?: string;
}

/**
 * Stock changes allowed from an order page: a status for status-managed stock, a count for counted stock,
 * or units added back (`delta`, counted stock only — e.g. a refund restock).
 */
export type StockChange = { status: Extract<StockStatus, "in_stock" | "out_of_stock"> } | { quantity: number } | { delta: number };

/** Who/what changed stock, for the stock movement history. */
export interface StockChangeContext {
  source: StockMovementSource;
  byName: string;
  orderId?: ID;
  orderNumber?: string;
  note?: string;
}

export function lineStock(product: Product | null | undefined, variationId?: ID): LineStock | null {
  if (!product) return null;
  const archived = product.status === "archived" ? "The product is archived." : undefined;
  if (product.type === "variable" || variationId) {
    const v = product.variations.find((x) => x.id === variationId);
    if (!v) return { stock: { status: "out_of_stock" }, mode: "status", shared: false, unavailable: "This option no longer exists." };
    const shared = v.stockMode === "parent";
    return {
      stock: { ...v.stock },
      mode: v.stockMode === "track" || (shared && product.manageStock) ? "quantity" : "status",
      shared,
      unavailable: archived ?? (v.status !== "active" ? "This option is disabled." : undefined),
    };
  }
  return { stock: { ...product.stock }, mode: product.manageStock ? "quantity" : "status", shared: false, unavailable: archived };
}

export const isOutOfStock = (stock: StockInfo) => stock.status === "out_of_stock";

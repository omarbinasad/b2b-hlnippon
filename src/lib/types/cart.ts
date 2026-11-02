import type { ID, Money } from "./common";
import type { ProductImage, StockStatus } from "./catalog";
import type { PaymentMethodId } from "./payment";
import type { Order } from "./order";

/** What the browser may send: product, option and quantity. Prices are always resolved on the server. */
export interface CartLineInput {
  productId: ID;
  variationId?: ID;
  quantity: number;
}

/** A cart line priced for the customer at its quantity (bulk tiers apply), with what blocks checkout. */
export interface CartLine extends CartLineInput {
  /** `${productId}:${variationId ?? ""}` — one line per product option. */
  id: string;
  slug: string;
  name: string;
  sku: string;
  variationLabel?: string;
  image?: ProductImage;
  unitLabel: string;
  pricedByWeight: boolean;
  stockStatus: StockStatus;
  unitPrice?: Money;
  lineTotal?: Money;
  /** e.g. "Your price", "Sale price", a tier label. */
  priceNote?: string;
  minQuantity: number;
  maxQuantity?: number;
  step: number;
  /** Set when this line can't be ordered as it is (quantity rule, stock, no price, removed product). */
  error?: string;
}

/**
 * One orderable option (a simple product or one active variation) on the quick order sheet, priced for the customer
 * at its minimum quantity. `error` = why it can't be ordered now (out of stock, no price…). Prices are absent for
 * viewers who may not see wholesale prices.
 */
export type QuickOrderLine = Omit<CartLine, "quantity" | "lineTotal">;

export interface QuickOrderQuery {
  /** Name, SKU (incl. variation SKUs) or GTIN. */
  search?: string;
  /** Includes subcategories. */
  categorySlug?: string;
  /** Limit to these products (e.g. the products on a shop page). */
  productIds?: ID[];
  page?: number;
}

/** A page of the quick order sheet. Pages count products; a variable product contributes one line per option. */
export interface QuickOrderPage {
  lines: QuickOrderLine[];
  page: number;
  totalPages: number;
  totalProducts: number;
}

export interface Cart {
  customerId: ID;
  lines: CartLine[];
  /** Sum of priced lines, before shipping and tax. */
  itemsSubtotal: Money;
  /** True when every line can be ordered. */
  valid: boolean;
  updatedAt?: string;
}

/** Customer checkout. Addresses come from the customer's own address book. */
export interface CheckoutInput {
  shippingAddressId: ID;
  /** Defaults to the customer's default billing address, else the delivery address. */
  billingAddressId?: ID;
  paymentMethod: PaymentMethodId;
  /** YYYY-MM-DD, today or later in the store time zone. */
  requestedDeliveryDate?: string;
  customerNote?: string;
  /** One per checkout page view: a repeated submission returns the order already placed. */
  idempotencyKey: string;
}

/** What checkout would create, without saving it. */
export type CheckoutPreview = Pick<Order, "items" | "shipping" | "taxes" | "totals" | "paymentStatus">;

import type { ID, ISODateString, Money } from "./common";

export type CouponType = "percent" | "fixed_cart" | "fixed_product";

export interface Coupon {
  id: ID;
  /** Stored in capitals. */
  code: string;
  description?: string;
  type: CouponType;
  /** Percent, or an amount in the store currency. */
  amount: number;
  /** On the cart subtotal. */
  minSpend?: Money;
  maxSpend?: Money;
  /** Limits to these products or categories; both empty means every product. */
  productIds: ID[];
  categorySlugs: string[];
  excludedProductIds: ID[];
  /** Limits to these customers or groups; both empty means every approved customer. */
  customerIds: ID[];
  groupIds: ID[];
  /** YYYY-MM-DD in store time, both inclusive. */
  startsOn?: string;
  expiresOn?: string;
  usageLimit?: number;
  usageLimitPerCustomer?: number;
  usedCount: number;
  enabled: boolean;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export type CouponInput = Omit<Coupon, "id" | "usedCount" | "createdAt" | "updatedAt">;

export interface CouponUsage {
  id: ID;
  couponId: ID;
  orderId: ID;
  orderNumber: string;
  customerId: ID;
  customerName: string;
  discount: Money;
  at: ISODateString;
}

/** A coupon applied to an order. Recorded apart from the staff order discount. */
export interface OrderCoupon {
  code: string;
  amount: Money;
}

/** The coupon on a cart, re-checked on every read. */
export interface CartCoupon {
  code: string;
  /** Set while the coupon applies. */
  discount?: Money;
  /** Why it doesn't apply right now. */
  error?: string;
}

export type CouponListStatus = "active" | "disabled" | "expired";

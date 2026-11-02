import type { LegacyRef, ProductType, StockInfo, TaxClass } from "./catalog";
import type { ID, ISODateString, Money, Weight } from "./common";
import type { Address } from "./customer";
import type { ShippingDecision } from "./shipping";
import type { OrderTaxSnapshot } from "./tax";

// --- Statuses -----------------------------------------------------------------------

/** Main delivery flow received → preparing → on_the_way → delivered; cancelled is separate. */
export type OrderStatus = "received" | "preparing" | "on_the_way" | "delivered" | "cancelled";

export type PaymentStatus = "unpaid" | "invoiced" | "paid" | "partially_refunded" | "refunded";

export type PaymentMethod = "cash_on_delivery" | "bank_transfer" | "mobile_wallet" | "invoice";

/**
 * Derived for listings: "first" = the customer has no earlier non-cancelled order; "repeat" = they do;
 * "walk_in" = no customer account.
 */
export type OrderType = "first" | "repeat" | "walk_in";

/** Who did something (for history and audit). */
export interface Actor {
  id: ID;
  name: string;
  role: "admin" | "customer" | "system";
}

export interface StatusEvent {
  id: ID;
  status: OrderStatus;
  at: ISODateString;
  by: Actor;
  /** e.g. the cancellation reason. */
  note?: string;
}

// --- Items --------------------------------------------------------------------------

/**
 * One ordered line. Product details are SNAPSHOTS taken when the order was
 * placed, so later catalog edits (name, SKU, price, weight) never rewrite it.
 */
export interface OrderItem extends LegacyRef {
  id: ID;
  /** References for linking only — never re-read for display or totals. */
  productId: ID;
  variationId?: ID;
  name: string;
  sku: string;
  /** Selected variation options, e.g. { Size: "20 kg" }. */
  attributes?: Record<string, string>;
  unitLabel: string;
  taxClass: TaxClass;
  /** Price follows the packed weight (variable-weight products). */
  pricedByWeight: boolean;
  quantity: number;
  /** Catalog price per unit when ordered (snapshot, for reference). */
  catalogUnitPrice: Money;
  /** Agreed price per unit; may be adjusted by an admin. */
  unitPrice: Money;
  /** Line discount (store currency); 0 when none. */
  discount: Money;
  /** quantity × unit weight at order time. */
  orderedWeight: Weight;
  /** Actual packed weight, once weighed/adjusted. */
  fulfilledWeight?: Weight;
  /** Derived from the fields above (see src/lib/orders/calc.ts). */
  lineSubtotal: Money;
  lineTotal: Money;
  /** Snapshot of the price rule outcome at order time; later rule edits never change it. */
  pricing?: OrderItemPricing;
  /** Product tax status at order time: false for "none" / "shipping only". Absent = taxable. */
  taxable?: boolean;
  /** Line total excluding tax (net sales). Set on orders with a tax snapshot; absent = lineTotal (tax was never inside it). */
  lineNet?: Money;
}

export interface OrderItemPricing {
  /** Regular catalog price when ordered. */
  basePrice: Money;
  /** Active sale price when ordered, if any. */
  salePrice?: Money;
  /** Price the winning rule produced, when a rule applied. */
  rulePrice?: Money;
  /** Suggested unit price: the lower of the rule price and the active sale price, else the regular price. */
  ruleUnitPrice: Money;
  /** Where the suggested price came from (sale and rule discounts are never combined). */
  source: "rule" | "sale" | "regular";
  ruleId?: ID;
  ruleName?: string;
  tier?: { minQuantity: number; maxQuantity?: number };
  /** True when staff agreed a different unit price than the rule price. */
  manualOverride: boolean;
}

export interface TaxLine {
  taxClass: TaxClass;
  /** Rate as a percentage, as configured in the backend tax settings. */
  rate: number;
  /** Amount taxed, excluding tax. */
  taxableAmount: Money;
  taxAmount: Money;
  /** Rate snapshot (orders created with tax settings); absent on older orders using placeholder class rates. */
  rateId?: ID;
  rateName?: string;
}

export interface ShippingCharge {
  label: string;
  /** The amount saved with the order. Never recalculated when shipping rules change. */
  amount: Money;
  taxClass: TaxClass;
  deliveryRouteId?: ID;
  /** Admin-created orders: whether staff used the suggested charge or agreed a manual one. */
  decision?: ShippingDecision;
}

export interface PaymentDetails {
  method: PaymentMethod;
  /** Gateway / bank reference, when known. */
  reference?: string;
  paidAt?: ISODateString;
  /**
   * Amount received and kept (after any refunds), when payment was collected before the order changed.
   * Set the first time a paid order is edited; balance = `totals.netTotal − amountPaid`.
   * Absent = nothing collected yet, so the current total is what's due.
   */
  amountPaid?: Money;
}

/**
 * A recorded refund. Processing happens in the payment backend; this only stores what happened.
 * "order" refunds (items, shipping or a goodwill amount) lower the order value (`totals.refundedTotal`);
 * "overpayment" refunds only return money paid above the current total and leave the order value as it is.
 */
export interface Refund {
  id: ID;
  /** Absent = "order". */
  kind?: RefundKind;
  amount: Money;
  reason: string;
  at: ISODateString;
  by: Actor;
  /** "recorded" = noted here only (demo, no money moved); "processed" = confirmed by the payment provider (backend). */
  status: "recorded" | "processed";
  /** Item quantities and amounts this refund covers. */
  lines?: RefundLine[];
  /** Shipping amount included in `amount`. */
  shipping?: Money;
  /** Stock returned to the catalog for refunded quantities. */
  restock?: RefundRestock[];
}

export type RefundKind = "order" | "overpayment";

export interface RefundLine {
  orderItemId: ID;
  /** Item name at the time (readable history). */
  name: string;
  /** Units refunded (0 = an amount only, e.g. a price correction). */
  quantity: number;
  amount: Money;
}

export interface RefundRestock {
  orderItemId: ID;
  quantity: number;
  /** "skipped": stock is managed by status, or the product/option no longer exists. */
  result: "restocked" | "skipped";
  note?: string;
}

/** Admin input for a refund. The refund amount = line amounts + shipping + `other`. */
export interface RefundInput {
  kind: RefundKind;
  lines: { orderItemId: ID; quantity: number; amount: Money }[];
  shipping: Money;
  /** An amount not tied to an item or shipping (e.g. goodwill, or the overpaid amount). */
  other: Money;
  reason: string;
  /** Return refunded quantities to stock (counted stock only). */
  restock: boolean;
}

/** Admin records that payment was received outside the site (bank transfer, cash on delivery). Never charges anyone. */
export interface RecordPaymentInput {
  reference?: string;
}

export type OrderNoteType = "admin" | "customer";

export interface OrderNote {
  id: ID;
  /** admin = staff only; customer = visible to the customer in their account. */
  type: OrderNoteType;
  body: string;
  at: ISODateString;
  by: Actor;
}

/** Order-level discount on the items (after line discounts, before tax), set by an admin. */
export interface OrderDiscount {
  type: "fixed" | "percent";
  /** Store-currency amount for "fixed"; a percentage (above 0, at most 100, up to 2 decimals) for "percent". */
  value: number;
  reason: string;
  at: ISODateString;
  by: Actor;
}

/** What an admin changed on an order (audit history). */
export type OrderChangeKind = "adjust" | "add" | "remove" | "replace" | "discount" | "delivery_date" | "address" | "shipping";

/** Values before/after a change: only the fields the change touched, plus the order total. */
export interface OrderChangeValues {
  quantity?: number;
  unitPrice?: Money;
  fulfilledWeight?: Weight;
  lineTotal?: Money;
  /** Order discount; null = none. */
  discount?: Pick<OrderDiscount, "type" | "value"> | null;
  /** YYYY-MM-DD; null = none. */
  deliveryDate?: string | null;
  /** Shipping charge and label (for "shipping"). */
  shipping?: Money;
  shippingLabel?: string;
  /** One-line address (for "address"). */
  address?: string;
  orderTotal: Money;
}

/**
 * Audit record of an admin changing an order: an item's price, weight or quantity, adding, removing or
 * replacing an item, the order discount or the delivery date. Catalog products are never changed by these.
 */
export interface OrderAdjustment {
  id: ID;
  kind: OrderChangeKind;
  /** The item changed (for "replace": the new item). Absent for order-level changes. */
  orderItemId?: ID;
  /** Item name at the time (for readable history); for "replace": the new item. */
  itemName?: string;
  /** "replace" only: the item that was taken out. */
  replacedItemName?: string;
  /** "address" only: which address changed. */
  addressType?: "billing" | "shipping";
  reason: string;
  at: ISODateString;
  by: Actor;
  before: OrderChangeValues;
  after: OrderChangeValues;
}

export interface OrderTotals {
  itemsSubtotal: Money;
  discountTotal: Money;
  /** Net sales: items after discounts, excl. VAT and shipping. */
  itemsTotal: Money;
  /** Order-level discount amount (already included in `discountTotal`); absent when there is none. */
  orderDiscount?: Money;
  shippingTotal: Money;
  taxTotal: Money;
  total: Money;
  refundedTotal: Money;
  netTotal: Money;
  /** true when the order's prices included tax (tax was extracted, not added). */
  taxIncluded?: boolean;
  /** Items after discounts excluding tax — net sales. Set on orders with a tax snapshot; absent = itemsTotal. */
  itemsNet?: Money;
  /** Tax on the items only (excluding shipping tax). */
  itemsTax?: Money;
}

/** Walk-in buyer details for an order without a registered account (only what staff entered). */
export interface WalkInCustomer {
  name: string;
  companyName?: string;
}

/** "pickup" = collected at the store (walk-in orders only; no delivery address, taxed at the store location). */
export type Fulfilment = "delivery" | "pickup";

export interface Order extends LegacyRef {
  id: ID;
  number: string;
  /** The registered customer; absent for walk-in orders (see `walkIn`). */
  customerId?: ID;
  /** Set for walk-in orders created by staff without a customer account. */
  walkIn?: WalkInCustomer;
  /** Customer company name (or the walk-in buyer's name) at the time of the order (snapshot, for lists and search). */
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  status: OrderStatus;
  statusHistory: StatusEvent[];
  paymentStatus: PaymentStatus;
  payment: PaymentDetails;
  items: OrderItem[];
  /** Absent only for walk-in orders collected at the store. */
  billingAddress?: Address;
  /** Absent only for walk-in orders collected at the store. */
  shippingAddress?: Address;
  /** Absent = "delivery". */
  fulfilment?: Fulfilment;
  shipping: ShippingCharge;
  taxes: TaxLine[];
  totals: OrderTotals;
  /** Tax settings and matched rates frozen at order time; recalculation uses these, never current rates. */
  taxSnapshot?: OrderTaxSnapshot;
  refunds: Refund[];
  notes: OrderNote[];
  /** Order-level discount, if any (the amount is `totals.orderDiscount`). */
  discount?: OrderDiscount;
  adjustments: OrderAdjustment[];
  /** Issued invoices, revisions and credit notes, oldest first. Append-only: issued documents are never rewritten. */
  invoices?: Invoice[];
  /** Note the customer wrote when ordering. */
  customerNote?: string;
  requestedDeliveryDate?: ISODateString;
  createdVia: "storefront" | "admin";
  createdBy?: Actor;
  placedAt: ISODateString;
  updatedAt: ISODateString;
}

// --- Admin payloads -----------------------------------------------------------------

/** Address fields entered/edited for an order (snapshotted onto it). */
export type OrderAddressInput = Omit<Address, "id" | "type" | "isDefault" | "label" | "legacyWooId">;

export interface CreateOrderInput {
  /** Registered customer; omit (with `walkIn`) for a walk-in order. */
  customerId?: ID;
  /** Walk-in buyer (no account is created). Name required; email and phone optional. */
  walkIn?: WalkInCustomer & { email?: string; phone?: string };
  /** Absent = "delivery". "pickup" is for walk-in orders only. */
  fulfilment?: Fulfilment;
  /** Required for delivery; ignored for pickup. */
  billingAddress?: OrderAddressInput;
  shippingAddress?: OrderAddressInput;
  items: { productId: ID; variationId?: ID; quantity: number; unitPrice: Money; discount: Money }[];
  shipping: { label: string; amount: Money; mode: "suggested" | "manual"; reason?: string };
  paymentMethod: PaymentMethod;
  customerNote?: string;
  adminNote?: string;
  requestedDeliveryDate?: string;
}

export interface AdjustItemInput {
  itemId: ID;
  /** New quantity; the ordered weight scales with it. */
  quantity?: number;
  unitPrice?: Money;
  fulfilledWeight?: Weight;
  reason: string;
}

/** Admin edits to an existing order. Each is validated, recalculated and recorded in `adjustments`. */
export type OrderEdit =
  | ({ kind: "adjust" } & AdjustItemInput)
  /** Add a product line; with `replaceItemId` the new line replaces that item in one step. */
  | { kind: "add"; productId: ID; variationId?: ID; quantity: number; unitPrice: Money; discount: Money; reason: string; replaceItemId?: ID }
  | { kind: "remove"; itemId: ID; reason: string }
  /** `discount: null` removes the order discount. */
  | { kind: "discount"; discount: Pick<OrderDiscount, "type" | "value"> | null; reason: string }
  /** YYYY-MM-DD, or null to clear. */
  | { kind: "delivery_date"; date: string | null; reason?: string }
  /** Replaces the billing or delivery address on this order only (the customer's address book is not changed). */
  | { kind: "address"; which: "billing" | "shipping"; address: OrderAddressInput; reason: string }
  /** Sets an agreed shipping charge for this order. */
  | { kind: "shipping"; label: string; amount: Money; reason: string };

/** An edit applied without saving (for the confirmation preview). */
export interface OrderEditPreview {
  totalBefore: Money;
  totalAfter: Money;
  /** totalAfter − totalBefore. */
  difference: Money;
  /** Line total after the change, for item edits. */
  lineTotal?: Money;
  /** Order discount amount after the change (0 = none). */
  orderDiscount: Money;
  /** Balance against the amount already paid, when payment was collected (positive = still due, negative = overpaid). */
  balanceAfter?: Money;
}

/** One purchasable option (the product itself, or one variation) for the admin order form. */
export interface OrderableOption {
  variationId?: ID;
  /** e.g. "Size: 5 kg"; empty for simple products. */
  label: string;
  sku: string;
  available: boolean;
  stock: StockInfo;
  taxClass: TaxClass;
  weight: Weight;
  catalogPrice: Money;
  /** Price this customer would pay at the minimum quantity (price rules applied). */
  customerPrice: Money;
  /** Per-line quantity limits from the quantity rules. */
  minQuantity: number;
  maxQuantity?: number;
}

/** Rule outcome for one order line at a given quantity (DEMO calculation; the backend enforces it). */
export interface OrderLineQuote {
  unitPrice: Money;
  /** Regular price. */
  basePrice: Money;
  salePrice?: Money;
  /** Winning rule's price, when a rule applied (the sale price may still be lower). */
  rulePrice?: Money;
  priceSource: "rule" | "sale" | "regular";
  ruleName?: string;
  /** e.g. "10+" or "5–9". */
  tierLabel?: string;
  minQuantity: number;
  maxQuantity?: number;
  quantityError?: string;
}

export interface OrderableProduct {
  productId: ID;
  name: string;
  type: ProductType;
  unitLabel: string;
  pricedByWeight: boolean;
  options: OrderableOption[];
}

/** Customer details the admin order form needs: addresses and a suggested delivery charge. */
export interface OrderCustomerContext {
  id: ID;
  companyName: string;
  contactName?: string;
  email?: string;
  phone?: string;
  addresses: Address[];
}

// --- Invoices -----------------------------------------------------------------------

/** "invoice" = first issue; "revision" = replaces the previous document after the order changed; "credit_note" = cancels it. */
export type InvoiceKind = "invoice" | "revision" | "credit_note";

/** What an invoice shows, frozen when it is issued (later order edits never change it). */
export interface InvoiceSnapshot {
  orderNumber: string;
  placedAt: ISODateString;
  customerName: string;
  walkIn?: WalkInCustomer;
  customerEmail?: string;
  customerPhone?: string;
  billingAddress?: Address;
  shippingAddress?: Address;
  fulfilment?: Fulfilment;
  requestedDeliveryDate?: ISODateString;
  items: OrderItem[];
  discount?: Pick<OrderDiscount, "type" | "value">;
  shipping: Pick<ShippingCharge, "label" | "amount">;
  taxes: TaxLine[];
  totals: OrderTotals;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  amountPaid?: Money;
}

export interface Invoice {
  id: ID;
  /** e.g. "INV-2026-0007", "INV-2026-0007-R1", "CN-2026-0007". */
  number: string;
  kind: InvoiceKind;
  /** Revisions and credit notes: the document number they replace or cancel. */
  replaces?: string;
  /** Required for revisions and credit notes. */
  reason?: string;
  issuedAt: ISODateString;
  issuedBy: Actor;
  snapshot: InvoiceSnapshot;
  /** Revisions and credit notes: total change against the replaced document (negative = credit to the customer). */
  difference?: Money;
}

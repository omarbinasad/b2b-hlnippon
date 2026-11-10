import type { ID, ISODateString, Money } from "./common";
import type { Address } from "./customer";
import type { DeliveryRoute } from "./delivery";
import type { InvoiceKind, OrderStatus } from "./order";

// --- Saved lists ------------------------------------------------------------------------

export interface SavedListItem {
  id: ID;
  productId: ID;
  variationId?: ID;
  quantity: number;
}

export interface SavedList {
  id: ID;
  customerId: ID;
  name: string;
  items: SavedListItem[];
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

/** A list line with live product details and this customer's current price. */
export interface SavedListLine extends SavedListItem {
  name: string;
  sku: string;
  optionLabel?: string;
  unitLabel: string;
  unitPrice?: Money;
  /** Why it can't be ordered right now. */
  unavailable?: string;
}

export type SavedListDetail = Omit<SavedList, "items"> & { lines: SavedListLine[] };

export type SavedListLineInput = Pick<SavedListItem, "productId" | "variationId" | "quantity">;

// --- Quotations -------------------------------------------------------------------------

export type QuotationStatus = "requested" | "quoted" | "accepted" | "rejected" | "declined" | "expired";

export interface QuotationItem {
  id: ID;
  productId: ID;
  variationId?: ID;
  name: string;
  sku: string;
  optionLabel?: string;
  quantity: number;
  /** Set by staff when they send the quote. */
  quotedUnitPrice?: Money;
}

export interface QuotationEvent {
  id: ID;
  status: QuotationStatus;
  at: ISODateString;
  byName: string;
  note?: string;
}

export interface Quotation {
  id: ID;
  number: string;
  customerId: ID;
  customerName: string;
  status: QuotationStatus;
  items: QuotationItem[];
  customerNote?: string;
  /** Shown to the customer with the quote. */
  staffNote?: string;
  /** YYYY-MM-DD. After this the customer can no longer accept. */
  validUntil?: string;
  /** The order created when the customer accepted. */
  orderId?: ID;
  orderNumber?: string;
  history: QuotationEvent[];
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface QuotationRequestInput {
  items: SavedListLineInput[];
  customerNote?: string;
}

export interface QuotationQuoteInput {
  prices: Record<ID, Money>;
  validUntil: string;
  staffNote?: string;
}

// --- Portal views -----------------------------------------------------------------------

export interface AccountSummary {
  totalOrders: number;
  openOrders: number;
  monthSpend: Money;
  lastMonthSpend: Money;
  byStatus: { status: OrderStatus; count: number }[];
}

export interface InvoiceListItem {
  id: ID;
  number: string;
  kind: InvoiceKind;
  replaces?: string;
  orderId: ID;
  orderNumber: string;
  issuedAt: ISODateString;
  total: Money;
}

export interface UpcomingDelivery {
  date: string;
  orderByDate: string;
  orderByTime: string;
}

export interface CustomerDeliveryLocation {
  address: Address;
  route?: Pick<DeliveryRoute, "id" | "name" | "deliveryDays" | "cutoffTime">;
  upcoming: UpcomingDelivery[];
}

export interface CustomerProfileInput {
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  remindersOptOut?: boolean;
}

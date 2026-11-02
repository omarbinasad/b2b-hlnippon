import type { LegacyRef } from "./catalog";
import type { ID, ISODateString, Money } from "./common";
import type { Actor } from "./order";

export type AccountStatus = "pending" | "approved" | "rejected" | "suspended";

/**
 * Group of customers. The stable `id` is what future price rules and quantity
 * rules will target (`scope: { type: "group", groupId }`) — renaming keeps it.
 */
export interface CustomerGroup extends LegacyRef {
  id: ID;
  name: string;
  description?: string;
}

export type AddressType = "shipping" | "billing";

/** Japanese address: postcode (NNN-NNNN) → prefecture (都道府県) → city (市区町村) → optional town (町域) → street/building. */
export interface Address extends LegacyRef {
  id: ID;
  type: AddressType;
  label: string;
  recipientName: string;
  companyName?: string;
  /** ISO 3166-1 alpha-2, e.g. "JP". */
  country: string;
  prefecture: string;
  city: string;
  /** Town (町域), e.g. "Nishi-Shinjuku"; optional. */
  area?: string;
  postalCode: string;
  addressLine1: string;
  addressLine2?: string;
  phone: string;
  isDefault: boolean;
}

/** One approval decision, kept as an audit trail. */
export interface AccountStatusEvent {
  id: ID;
  /** Undefined for the first entry (account created). */
  from?: AccountStatus;
  to: AccountStatus;
  /** Required for rejections and suspensions. */
  reason?: string;
  at: ISODateString;
  by: Actor;
}

export interface Customer extends LegacyRef {
  id: ID;
  /** Business (trading) name — the only required name. */
  companyName: string;
  /** Contact details can be completed later, but at least one of phone or email is required. */
  contactName?: string;
  email?: string;
  phone?: string;
  businessType?: string;
  /** Trade licence number (optional, verified by staff). */
  tradeLicenseNumber?: string;
  /** VAT Business Identification Number (optional). */
  vatRegistrationNumber?: string;
  status: AccountStatus;
  statusHistory: AccountStatusEvent[];
  groupId?: ID;
  deliveryRouteId?: ID;
  addresses: Address[];
  /** Internal staff note; never shown to the customer. */
  internalNote?: string;
  /** Identity documents uploaded with the application. Staff only; file bytes are served by a separate admin call. */
  documents?: CustomerDocument[];
  createdAt: ISODateString;
  approvedAt?: ISODateString;
  updatedAt?: ISODateString;
}

/** Admin list row: customer + order aggregates (non-cancelled orders). */
export interface CustomerListItem extends Customer {
  groupName?: string;
  orderCount: number;
  /** Sum of order totals after refunds, excluding cancelled orders. */
  totalSpend: Money;
  lastOrderAt?: ISODateString;
}

/** Quick add: only the essentials; everything else can be completed later. */
export interface CustomerQuickInput {
  companyName: string;
  contactName?: string;
  phone?: string;
  email?: string;
  /** Initial approval status. */
  status: "pending" | "approved";
  groupId?: ID;
}

/** Online wholesale application (see src/lib/validation/registration.ts). No password: accounts need the backend. */
export type CustomerDocumentKind = "residence_card_front" | "residence_card_back" | "business_license";

/** Metadata of an uploaded identity document (never the file itself). */
export interface CustomerDocument {
  id: ID;
  kind: CustomerDocumentKind;
  fileName: string;
  /** Detected from the file's content, not trusted from the browser. */
  contentType: DocumentContentType;
  /** Bytes. */
  size: number;
  uploadedAt: ISODateString;
}

export type DocumentContentType = "image/jpeg" | "image/png" | "image/webp" | "application/pdf";

/** A file received from a form, before it is stored. */
export interface DocumentUpload {
  kind: CustomerDocumentKind;
  fileName: string;
  bytes: Uint8Array;
}

export interface RegistrationInput {
  companyName: string;
  businessType: string;
  contactName: string;
  email: string;
  phone: string;
  tradeLicenseNumber?: string;
  address: { prefecture: string; city: string; area?: string; postalCode: string; addressLine1: string };
  message?: string;
  acceptTerms: boolean;
  /** Optional copies: Japan Residence Card (front / back) and business license. */
  documents?: DocumentUpload[];
}

/** Full edit of the customer's own details (addresses and status have their own calls). */
export interface CustomerDetailsInput {
  companyName: string;
  contactName?: string;
  phone?: string;
  email?: string;
  businessType?: string;
  tradeLicenseNumber?: string;
  vatRegistrationNumber?: string;
  groupId?: ID;
  deliveryRouteId?: ID;
  internalNote?: string;
}

/** Create (no id) or update (id) one address in the customer's address book. */
export type AddressInput = Omit<Address, "id" | "legacyWooId"> & { id?: ID };

export interface CustomerGroupInput {
  name: string;
  description?: string;
}

/** Result of the postal-code lookup. Only a small sample dataset exists today. */
export type PostcodeLookup =
  | { status: "found"; postalCode: string; matches: { prefecture: string; city: string; area: string; postOffice: string }[] }
  | { status: "not_found"; postalCode: string; datasetSize: number };

export type NotificationKind = "order" | "delivery" | "account" | "reminder";

export interface CustomerNotification {
  id: ID;
  customerId: ID;
  kind: NotificationKind;
  title: string;
  body: string;
  createdAt: ISODateString;
  readAt?: ISODateString;
}

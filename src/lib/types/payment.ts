import type { ISODateString } from "./common";
import type { PaymentMethod } from "./order";

/*
 * Payment method SETTINGS (demo configuration only). Nothing here processes payments,
 * stores card details or gateway secrets, or marks orders paid. Availability rules live in
 * src/lib/payments/methods.ts; the backend must enforce them at checkout.
 */

export type PaymentMethodId = "pay_on_delivery" | "bank_transfer" | "online";

/** Bank account shown to customers who choose Bank Transfer. Demo values are fictional. */
export interface BankAccountDetails {
  accountName: string;
  bankName: string;
  accountNumber: string;
  branchName?: string;
  /** Optional bank/branch code shown to the customer (e.g. a 4-digit bank and 3-digit branch code in Japan). */
  routingNumber?: string;
}

/**
 * Online payment provider connection. Only the backend may hold provider credentials;
 * the frontend only ever sees the connection state.
 */
export interface OnlinePaymentConnection {
  status: "not_connected" | "connected";
  /** Display name of the connected provider, once a backend integration exists. */
  providerName?: string;
}

export interface PaymentMethodSettings {
  id: PaymentMethodId;
  enabled: boolean;
  /** Display order at checkout (lower first). */
  sortOrder: number;
  /** Customer-facing name, e.g. "Pay on delivery". */
  title: string;
  /** Short customer-facing line shown next to the option. */
  description: string;
  /** Shown to the customer after choosing the method / on the order confirmation. */
  instructions: string;
  /** Bank Transfer only. */
  bank?: BankAccountDetails;
  /** Online Payment only. */
  online?: OnlinePaymentConnection;
  /** Order payment method recorded when a customer uses this option (no payment status change). */
  orderPaymentMethod?: PaymentMethod;
  /** Gateway id in the old store (e.g. "cod", "bacs"), for migration. */
  legacyWooGatewayId?: string;
  updatedAt: ISODateString;
}

/** Editable fields. Connection state is never editable from the browser. */
export interface PaymentMethodInput {
  enabled: boolean;
  title: string;
  description: string;
  instructions: string;
  bank?: BankAccountDetails;
}

export interface PaymentAvailability {
  /** Has everything it needs (e.g. bank details; a connected provider for online). */
  configured: boolean;
  /** Enabled and configured → offered at checkout. */
  availableAtCheckout: boolean;
  /** Plain-language reasons when not available. */
  reasons: string[];
}

/** What checkout will receive: customer-facing fields only, enabled and available methods, in order. */
export interface CheckoutPaymentMethod {
  id: PaymentMethodId;
  title: string;
  description: string;
  instructions: string;
  bank?: BankAccountDetails;
}

import { STANDARD_PRICING_ID } from "@/lib/pricing/standard";
import type { Customer } from "@/lib/types";
import { mockCustomers } from "./customers";

/**
 * DEMO: the approved customer that standard prices are worked out for: no group and no customer-specific rules, so
 * only rules for all approved customers (and sale prices) apply. Never stored, never listed.
 */
const STANDARD_CUSTOMER = {
  id: STANDARD_PRICING_ID,
  companyName: "Standard price",
  status: "approved",
  statusHistory: [],
  addresses: [],
  documents: [],
  createdAt: "2026-01-01T00:00:00+09:00",
  updatedAt: "2026-01-01T00:00:00+09:00",
} as unknown as Customer;

/** The customer to price for: a real one by id, or the standard one for staff. */
export const pricingCustomerById = (id: string | undefined | null) => (id === STANDARD_PRICING_ID ? STANDARD_CUSTOMER : id ? mockCustomers.find((c) => c.id === id) : undefined);

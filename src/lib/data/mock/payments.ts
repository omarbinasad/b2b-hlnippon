import type { PaymentMethodSettings } from "@/lib/types";

/*
 * DEMO payment method settings with FICTIONAL bank details. No gateway keys exist anywhere
 * in this project. Stored on globalThis like the other demo stores: edits survive page
 * refreshes on a long-running server, but are lost on restart — and on Vercel each
 * serverless instance has its own copy, so edits may disappear or differ between requests.
 */
const at = "2026-01-05T09:00:00+09:00";

const seedMethods: PaymentMethodSettings[] = [
  {
    id: "pay_on_delivery",
    enabled: true,
    sortOrder: 10,
    title: "Pay on delivery",
    description: "Pay in cash when your order arrives.",
    instructions: "Please keep the exact amount ready for the delivery person. The order is marked paid only after staff confirm the payment.",
    orderPaymentMethod: "cash_on_delivery",
    legacyWooGatewayId: "cod",
    updatedAt: at,
  },
  {
    id: "bank_transfer",
    enabled: true,
    sortOrder: 20,
    title: "Bank transfer",
    description: "Transfer the order total to our bank account.",
    instructions: "Use your order number as the transfer name (振込名義) reference. Transfer fees are paid by the customer. We process the order after staff confirm the transfer manually.",
    bank: {
      accountName: "Wholesale Store (demo, fictional)",
      bankName: "Sample Bank (fictional)",
      // Japanese style: account type + 7-digit account number.
      accountNumber: "Ordinary 1234567",
      branchName: "Shinjuku branch (fictional)",
    },
    orderPaymentMethod: "bank_transfer",
    legacyWooGatewayId: "bacs",
    updatedAt: at,
  },
  {
    id: "online",
    enabled: false,
    sortOrder: 30,
    title: "Pay online",
    description: "Card or QR code payment (coming later).",
    instructions: "You will be redirected to a secure payment page.",
    online: { status: "not_connected" },
    updatedAt: at,
  },
];

const store = globalThis as typeof globalThis & { __mockPaymentsV2?: { methods: PaymentMethodSettings[] } };
store.__mockPaymentsV2 ??= { methods: seedMethods };

export const mockPayments = store.__mockPaymentsV2;

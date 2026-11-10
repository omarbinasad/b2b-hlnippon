import type { CompanySettings } from "../lib/types/company.ts";

/**
 * Example company for the demo (HL Nippon). This file and the sample data are the only places its identity lives: a new deployment starts by
 * replacing these values (or, with the backend, by loading them from the company settings API). Nothing here is a rule
 * of the platform. Contact details are placeholders.
 */
export const SAMPLE_COMPANY: CompanySettings = {
  companyName: "HL Nippon Ltd (demo)",
  storeName: "HL Nippon",
  tagline: "Wholesale food supply for businesses across Japan",
  description: "B2B wholesale ordering for restaurants, grocers and distributors across Japan.",
  branding: {
    logoMain: { url: "/brand/hl-logo-on-light.webp", width: 922, height: 266 },
    logoLight: null,
    logoDark: { url: "/brand/hl-logo-on-dark.webp", width: 922, height: 266 },
    logoMobile: null,
    favicon: null,
    primaryColor: "#136045",
    secondaryColor: "#0d4a36",
    accentColor: "#c4314a",
    headingFont: "Inter",
    bodyFont: "Inter",
    buttonStyle: "rounded",
  },
  contact: {
    email: "info@example.com",
    phone: "03-0000-0000",
    hours: "Mon–Fri 9:00–18:00",
    address: { addressLine1: "1-1-1 Sample-cho (sample)", city: "Chiyoda-ku", prefecture: "Tokyo", postalCode: "100-0001", country: "JP" },
    map: { lat: 35.6812, lng: 139.7671, label: "Sample location in Tokyo" },
    social: [],
  },
  documents: { invoiceTitle: "Invoice", invoicePrefix: "INV", showLogoOnInvoice: true, showRegistrationOnInvoice: true, showTaxNumberOnInvoice: true, attachInvoicePdf: true, emailInvoiceOnIssue: false },
  locale: {
    country: "JP",
    currencyCode: "JPY",
    currencySymbol: "¥",
    currencyDigits: 0,
    symbolPosition: "before",
    numberLocale: "ja-JP",
    dateLocale: "en-GB",
    language: "en",
    timeZone: "Asia/Tokyo",
    weekStartsOn: 0,
    weightUnit: "kg",
    dimensionUnit: "cm",
  },
  setup: { completedAt: "2026-01-01T00:00:00+09:00" },
  updatedAt: "2026-01-01T00:00:00+09:00",
};

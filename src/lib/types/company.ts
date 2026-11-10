import type { ISODateString } from "./common";

/** An image chosen for branding. Width and height keep the layout stable. */
export interface BrandImage {
  url: string;
  width: number;
  height: number;
}

export type ButtonStyle = "rounded" | "pill" | "square";
export type SymbolPosition = "before" | "after";
export type SocialNetwork = "facebook" | "instagram" | "x" | "linkedin" | "youtube" | "tiktok" | "line" | "website";

export interface SocialLink {
  network: SocialNetwork;
  url: string;
}

export interface CompanyAddress {
  addressLine1: string;
  addressLine2?: string;
  area?: string;
  city: string;
  /** Top address level: prefecture, state, division… The label follows the country. */
  prefecture: string;
  postalCode: string;
  country: string;
}

export interface CompanyBranding {
  /** Used wherever no more specific logo is set. Null shows a text placeholder. */
  logoMain: BrandImage | null;
  /** On light backgrounds. Falls back to the main logo. */
  logoLight: BrandImage | null;
  /** On dark backgrounds and the admin sidebar. Falls back to the main logo. */
  logoDark: BrandImage | null;
  /** In the store header on phones. Falls back to the theme logo. */
  logoMobile: BrandImage | null;
  favicon: string | null;
  /** #rrggbb */
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  headingFont: string;
  bodyFont: string;
  buttonStyle: ButtonStyle;
}

export interface CompanyContact {
  email: string;
  phone: string;
  whatsapp?: string;
  hours?: string;
  address: CompanyAddress;
  map?: { lat: number; lng: number; label: string };
  social: SocialLink[];
}

/** How documents present the company. Invoice and email modules read these. */
export interface CompanyDocumentBranding {
  /** Heading on invoices, e.g. "Tax invoice". Default "Invoice". */
  invoiceTitle?: string;
  /** Number prefix, e.g. INV gives INV-2026-0001. */
  invoicePrefix?: string;
  invoiceHeaderNote?: string;
  showLogoOnInvoice?: boolean;
  showRegistrationOnInvoice?: boolean;
  showTaxNumberOnInvoice?: boolean;
  /** Settings for the backend's invoice email; nothing is sent in the demo. */
  attachInvoicePdf?: boolean;
  emailInvoiceOnIssue?: boolean;
  invoiceFooter?: string;
  emailSenderName?: string;
  emailFooter?: string;
}

export interface CompanyLocale {
  country: string;
  currencyCode: string;
  currencySymbol: string;
  /** Decimals an amount may have: 0 for JPY, 2 for USD. Drives money rounding. */
  currencyDigits: 0 | 2 | 3;
  symbolPosition: SymbolPosition;
  /** BCP 47 tag for number grouping, e.g. ja-JP. */
  numberLocale: string;
  /** BCP 47 tag for dates, e.g. en-GB. */
  dateLocale: string;
  /** Page language, e.g. en. */
  language: string;
  /** IANA name, e.g. Asia/Tokyo. */
  timeZone: string;
  /** First day of the week in date pickers: 0 = Sunday … 6 = Saturday. */
  weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  weightUnit: "kg" | "g";
  dimensionUnit: "cm" | "mm" | "m";
}

export interface CompanySetupProgress {
  completedAt?: ISODateString;
}

/** Everything that makes one deployment a particular company. One company per deployment. */
export interface CompanySettings {
  companyName: string;
  legalName?: string;
  storeName: string;
  tagline?: string;
  description?: string;
  registrationNumber?: string;
  taxNumber?: string;
  branding: CompanyBranding;
  contact: CompanyContact;
  documents: CompanyDocumentBranding;
  locale: CompanyLocale;
  setup: CompanySetupProgress;
  updatedAt: ISODateString;
}

export type CompanySettingsInput = Omit<CompanySettings, "updatedAt" | "setup">;

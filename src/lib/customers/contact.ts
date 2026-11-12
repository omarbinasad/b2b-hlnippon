/** Pure contact/address format checks, per store country. Unit-testable with Node directly. */
import { company } from "../../config/runtime.ts";

/**
 * Japanese phone number: domestic "0X…" with 10 digits (landline, e.g. 03-1234-5678) or 11 digits
 * (mobile 070/080/090, IP 050, e.g. 090-1234-5678), or international "+81" without the leading 0.
 * Spaces, dashes and brackets are allowed. Format only — not a check that the number exists.
 */
export function isJpPhone(value: string) {
  if (!/^[+\d][\d\s()-]*$/.test(value.trim())) return false;
  const digits = value.replace(/\D/g, "");
  const national = value.trim().startsWith("+") ? (digits.startsWith("81") ? `0${digits.slice(2)}` : "") : digits;
  return /^0[5789]0\d{8}$/.test(national) || /^0[1-9]\d{8}$/.test(national);
}

/** Any country: digits with optional +, spaces, dashes, brackets; 7 to 15 digits (E.164 length). */
const isGenericPhone = (value: string) => /^[+\d][\d\s()-]*$/.test(value.trim()) && value.replace(/\D/g, "").length >= 7 && value.replace(/\D/g, "").length <= 15;

interface CountryRules {
  phone: (v: string) => boolean;
  phoneError: string;
  postcode: RegExp;
  postcodeError: string;
  /** Storage form from digits, when the country writes postcodes with a separator. */
  formatPostcode?: (digits: string) => string | undefined;
}

const RULES: Record<string, CountryRules> = {
  JP: {
    phone: isJpPhone,
    phoneError: "Use a Japanese phone number, e.g. 03-1234-5678 or 090-1234-5678.",
    postcode: /^\d{3}-?\d{4}$/,
    postcodeError: "Use a 7-digit postcode, e.g. 160-0023.",
    formatPostcode: (d) => (d.length === 7 ? `${d.slice(0, 3)}-${d.slice(3)}` : undefined),
  },
  BD: {
    phone: (v) => /^(?:\+?880|0)1[3-9]\d{8}$/.test(v.replace(/[\s()-]/g, "")),
    phoneError: "Use a Bangladeshi mobile number, e.g. 01712-345678.",
    postcode: /^\d{4}$/,
    postcodeError: "Use a 4-digit postcode, e.g. 1207.",
  },
  US: {
    phone: isGenericPhone,
    phoneError: "Enter a valid phone number.",
    postcode: /^\d{5}(-\d{4})?$/,
    postcodeError: "Use a 5-digit ZIP code, e.g. 94105.",
  },
};

const DEFAULT_RULES: CountryRules = {
  phone: isGenericPhone,
  phoneError: "Enter a valid phone number.",
  postcode: /^[A-Za-z0-9][A-Za-z0-9 -]{1,9}$/,
  postcodeError: "Enter a valid postcode.",
};

const storeCountry = () => company().locale.country;
const rules = (country = storeCountry()) => RULES[country] ?? DEFAULT_RULES;

export const isPhone = (value: string, country?: string) => rules(country).phone(value);
export const phoneError = (country?: string) => rules(country).phoneError;
export const isPostcode = (v: string, country?: string) => rules(country).postcode.test(v.trim());
export const postcodeError = (country?: string) => rules(country).postcodeError;

/** Digits and letters only, for comparing postcodes written with or without a separator. */
export const postcodeKey = (v?: string) => (v ?? "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();

/** "1000001" / "100-0001" → "100-0001" in Japan; other countries keep what was typed. */
export const normalizePostcode = (v: string, country?: string) => rules(country).formatPostcode?.(v.replace(/\D/g, "")) ?? v.trim();

/**
 * How a postcode input behaves for the store country: its length limit, keyboard and which characters typing keeps.
 * Every postcode field uses this, so a country with longer or lettered postcodes is never cut off.
 */
export function postcodeInput(country = storeCountry()): { maxLength: number; inputMode: "numeric" | "text"; clean: (v: string) => string } {
  const digitsAndDash = (max: number) => ({ maxLength: max, inputMode: "numeric" as const, clean: (v: string) => v.replace(/[^\d-]/g, "").slice(0, max) });
  if (country === "JP") return digitsAndDash(8); // 160-0023
  if (country === "US") return digitsAndDash(10); // 94105-1234
  if (country === "BD") return { maxLength: 4, inputMode: "numeric", clean: (v) => v.replace(/\D/g, "").slice(0, 4) };
  return { maxLength: 10, inputMode: "text", clean: (v) => v.replace(/[^A-Za-z0-9 -]/g, "").slice(0, 10) };
}

export const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

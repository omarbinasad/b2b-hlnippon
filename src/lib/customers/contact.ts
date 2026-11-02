/** Pure contact/address format checks (no imports, so they are unit-testable with Node directly). */

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

/** Japanese postcode (郵便番号): 7 digits, written "1000001" or "100-0001". Format only. */
export const isPostcode = (v: string) => /^\d{3}-?\d{4}$/.test(v.trim());

/** Digits only, for comparing postcodes written with or without the hyphen. */
export const postcodeKey = (v?: string) => (v ?? "").replace(/\D/g, "");

/** "1000001" / "100-0001" → "100-0001" (display and storage form). */
export const normalizePostcode = (v: string) => {
  const d = v.replace(/\D/g, "");
  return d.length === 7 ? `${d.slice(0, 3)}-${d.slice(3)}` : v.trim();
};

export const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

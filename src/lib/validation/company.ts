/** Company settings validation, shared by the forms and the mock repository. The backend must enforce the same rules. */
import { HEX_COLOR, FONT_OPTIONS } from "../branding/css.ts";
import { isEmail, isPhone, isPostcode, phoneError, postcodeError } from "../customers/contact.ts";
import { addressLabels, isKnownRegion } from "../locations.ts";
import type { CompanySettingsInput } from "../types/company.ts";

type Errors = Record<string, string>;

const SOCIAL_URL = /^https:\/\/[^\s]+$/;

function isTimeZone(tz: string) {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function isLocale(tag: string) {
  try {
    return Intl.getCanonicalLocales(tag).length === 1;
  } catch {
    return false;
  }
}

export function validateCompanySettings(input: CompanySettingsInput): Errors {
  const errors: Errors = {};
  const need = (key: string, value: string | undefined, label: string, max = 120) => {
    const v = value?.trim() ?? "";
    if (v.length < 2) errors[key] = `Enter the ${label}.`;
    else if (v.length > max) errors[key] = `Keep it under ${max} characters.`;
  };
  need("companyName", input.companyName, "company name");
  need("storeName", input.storeName, "store name", 80);
  if ((input.tagline ?? "").length > 160) errors.tagline = "Keep it under 160 characters.";
  if ((input.description ?? "").length > 400) errors.description = "Keep it under 400 characters.";

  const { branding: b, contact: c, locale: l } = input;
  for (const key of ["primaryColor", "secondaryColor", "accentColor"] as const) {
    if (!HEX_COLOR.test(b[key])) errors[`branding.${key}`] = "Use a color like #136045.";
  }
  for (const key of ["headingFont", "bodyFont"] as const) {
    if (!FONT_OPTIONS.some((f) => f.name === b[key])) errors[`branding.${key}`] = "Choose a font from the list.";
  }
  if (!["rounded", "pill", "square"].includes(b.buttonStyle)) errors["branding.buttonStyle"] = "Choose a button style.";

  if (input.documents.invoicePrefix && !/^[A-Z0-9]{1,10}$/.test(input.documents.invoicePrefix)) errors["documents.invoicePrefix"] = "Use up to 10 letters and numbers, e.g. INV.";

  // Contact and address follow the country being saved, not the one currently active.
  const country = l.country;
  if (!isEmail(c.email)) errors["contact.email"] = "Enter a valid email address.";
  if (!isPhone(c.phone, country)) errors["contact.phone"] = phoneError(country);
  if (c.whatsapp?.trim() && !/^\+?[\d\s()-]{7,20}$/.test(c.whatsapp.trim())) errors["contact.whatsapp"] = "Enter the number with its country code.";
  if (!c.address.addressLine1.trim()) errors["contact.address.addressLine1"] = "Street address is required.";
  if (!c.address.city.trim()) errors["contact.address.city"] = "City is required.";
  if (!isKnownRegion(c.address.prefecture, country)) errors["contact.address.prefecture"] = `Choose a ${addressLabels(country).region.toLowerCase()}.`;
  if (!isPostcode(c.address.postalCode, country)) errors["contact.address.postalCode"] = postcodeError(country);
  c.social.forEach((s, i) => {
    if (!SOCIAL_URL.test(s.url.trim())) errors[`contact.social.${i}`] = "Use a full link starting with https://";
  });
  if (c.map && (Math.abs(c.map.lat) > 90 || Math.abs(c.map.lng) > 180)) errors["contact.map"] = "Latitude must be within ±90 and longitude within ±180.";

  if (!/^[A-Z]{2}$/.test(country)) errors["locale.country"] = "Choose a country.";
  if (!/^[A-Z]{3}$/.test(l.currencyCode)) errors["locale.currencyCode"] = "Use a 3-letter currency code, e.g. JPY.";
  if (!l.currencySymbol.trim() || l.currencySymbol.length > 4) errors["locale.currencySymbol"] = "Enter a symbol of up to 4 characters.";
  if (![0, 2, 3].includes(l.currencyDigits)) errors["locale.currencyDigits"] = "Choose 0, 2 or 3 decimals.";
  if (!isTimeZone(l.timeZone)) errors["locale.timeZone"] = "Choose a time zone.";
  if (!isLocale(l.numberLocale)) errors["locale.numberLocale"] = "Use a locale tag like en-US.";
  if (!isLocale(l.dateLocale)) errors["locale.dateLocale"] = "Use a locale tag like en-GB.";
  if (!isLocale(l.language)) errors["locale.language"] = "Use a language tag like en.";
  if (l.weightUnit !== "kg" && l.weightUnit !== "g") errors["locale.weightUnit"] = "Choose kg or g.";
  if (!["cm", "mm", "m"].includes(l.dimensionUnit)) errors["locale.dimensionUnit"] = "Choose cm, mm or m.";
  return errors;
}

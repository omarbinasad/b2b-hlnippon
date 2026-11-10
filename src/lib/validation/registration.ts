/**
 * Online wholesale application (registration) validation, shared by the form action and the mock repository.
 * The backend must enforce the same rules, plus uniqueness, rate limiting and the real account/password.
 */
import { isEmail, isPhone, isPostcode, phoneError, postcodeError } from "../customers/contact.ts";
import { addressLabels, isKnownRegion } from "../locations.ts";
import { validateDocuments } from "./documents.ts";
import type { FieldErrors, RegistrationInput } from "../types/index.ts";

export const BUSINESS_TYPES = ["Restaurant", "Hotel", "Caterer", "Grocery store", "Supermarket", "Distributor", "Other"] as const;

export function validateRegistration(input: RegistrationInput): FieldErrors {
  const errors: FieldErrors = {};
  const text = (v: string | undefined) => (v ?? "").trim();
  const company = text(input.companyName);
  if (company.length < 2) errors.companyName = "Enter the business name (at least 2 characters).";
  else if (company.length > 120) errors.companyName = "Keep it under 120 characters.";
  if (!BUSINESS_TYPES.includes(input.businessType as (typeof BUSINESS_TYPES)[number])) errors.businessType = "Choose a business type.";
  const contact = text(input.contactName);
  if (contact.length < 2) errors.contactName = "Enter the contact person's name.";
  else if (contact.length > 200) errors.contactName = "Too long.";
  if (!isEmail(text(input.email)) || text(input.email).length > 200) errors.email = "Enter a valid email address.";
  if (!isPhone(text(input.phone))) errors.phone = phoneError();
  if (text(input.tradeLicenseNumber).length > 100) errors.tradeLicenseNumber = "Too long.";

  const a = input.address;
  if (!isKnownRegion(text(a.prefecture))) errors["address.prefecture"] = `Choose a ${addressLabels().region.toLowerCase()}.`;
  if (!text(a.city)) errors["address.city"] = "City is required.";
  else if (text(a.city).length > 100) errors["address.city"] = "Too long.";
  if (!isPostcode(text(a.postalCode))) errors["address.postalCode"] = postcodeError();
  if (!text(a.addressLine1)) errors["address.addressLine1"] = "Street address is required.";
  else if (text(a.addressLine1).length > 200) errors["address.addressLine1"] = "Too long.";
  if (text(a.area).length > 100) errors["address.area"] = "Too long.";
  if (text(input.message).length > 1000) errors.message = "Keep it under 1000 characters.";
  if (input.acceptTerms !== true) errors.acceptTerms = "Please confirm the details are correct.";
  return { ...errors, ...validateDocuments(input.documents) };
}

/** Store settings validation shared by the settings form and the mock repository. */
import { isJpPhone, isEmail, isPostcode } from "@/lib/customers/contact";
import { JP_PREFECTURES } from "@/lib/locations";
import type { FieldErrors, StoreSettingsInput } from "@/lib/types";

export function validateStoreSettings(input: StoreSettingsInput): FieldErrors {
  const errors: FieldErrors = {};
  const name = input.storeName.trim();
  if (name.length < 2) errors.storeName = "Enter the store name.";
  else if (name.length > 80) errors.storeName = "Keep it under 80 characters.";
  if (input.email && !isEmail(input.email)) errors.email = "Enter a valid email address.";
  if (input.phone && !isJpPhone(input.phone)) errors.phone = "Use a Japanese phone number.";
  const a = input.address;
  if (!a.addressLine1.trim()) errors["address.addressLine1"] = "Street address is required.";
  if (!a.city.trim()) errors["address.city"] = "City is required.";
  if (!JP_PREFECTURES.includes(a.prefecture as (typeof JP_PREFECTURES)[number])) errors["address.prefecture"] = "Choose a prefecture.";
  if (!isPostcode(a.postalCode)) errors["address.postalCode"] = "Use a 7-digit postcode, e.g. 160-0023.";
  if (a.country !== "JP") errors["address.country"] = "The store is in Japan in this version.";
  if (input.weightUnit !== "kg" && input.weightUnit !== "g") errors.weightUnit = "Choose kg or g.";
  if (!["cm", "mm", "m"].includes(input.dimensionUnit)) errors.dimensionUnit = "Choose cm, mm or m.";
  for (const key of ["addressLine1", "addressLine2", "area", "city"] as const) {
    if (!errors[`address.${key}`] && (a[key] ?? "").length > 200) errors[`address.${key}`] = "Too long.";
  }
  return errors;
}

/** Brand form rules, shared by the mock and tests. The backend must repeat them. */
import type { BrandInput } from "../types/catalog.ts";

export const BRAND_LIMITS = { name: 60, displayOrder: 9999 } as const;

const SAFE_IMAGE = /^(?:https:\/\/\S+|\/(?!\/)\S+)$/;

export function validateBrand(input: BrandInput, takenName: (name: string) => boolean): Record<string, string> {
  const errors: Record<string, string> = {};
  const name = input.name.trim();
  if (!name) errors.name = "Enter a brand name.";
  else if (name.length > BRAND_LIMITS.name) errors.name = `Keep it under ${BRAND_LIMITS.name} characters.`;
  else if (takenName(name)) errors.name = "This brand already exists.";
  if (input.logo && !SAFE_IMAGE.test(input.logo.src)) errors.logo = "Choose an image from the media library.";
  if (!Number.isInteger(input.displayOrder) || input.displayOrder < 0 || input.displayOrder > BRAND_LIMITS.displayOrder) {
    errors.displayOrder = `Use a whole number from 0 to ${BRAND_LIMITS.displayOrder}.`;
  }
  return errors;
}

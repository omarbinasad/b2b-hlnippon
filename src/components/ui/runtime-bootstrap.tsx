"use client";

import { setCompany } from "@/config/runtime";
import type { CompanySettings } from "@/lib/types";

/**
 * Gives browser code the same company settings the server rendered with. It sets them during render, and sits before
 * the page in the root layout, so child components read the right values on their first render.
 */
export function RuntimeBootstrap({ settings }: { settings: CompanySettings }) {
  setCompany(settings);
  return null;
}

import type { CompanySettings } from "../lib/types/company.ts";
import { SAMPLE_COMPANY } from "./sample-company.ts";

/**
 * The current company settings, readable from anywhere: server code, client components, pure engines and tests.
 *
 * On the server the root layout sets it from `repositories.company`; in the browser `RuntimeBootstrap` sets it from
 * the same data, so both render alike. It holds public company settings only, never secrets or customer data. One
 * company per deployment, so one value per process is correct. Until something sets it, the sample company applies.
 */
const store = globalThis as typeof globalThis & { __storeCompany?: CompanySettings };

export const company = (): CompanySettings => store.__storeCompany ?? SAMPLE_COMPANY;

export function setCompany(settings: CompanySettings) {
  store.__storeCompany = settings;
}

import "server-only";

import { company, setCompany } from "@/config/runtime";
import { SAMPLE_COMPANY } from "@/config/sample-company";
import type { StoreSettings } from "@/lib/types";
import { validateCompanySettings } from "@/lib/validation/company";
import { clone, invalid, now } from "./mock-store-helpers";
import type { CompanyRepository } from "./repositories";

/** DEMO: the settings live in server memory (see `src/config/runtime.ts`) and return to the sample on restart. */
export const mockCompanyRepository: CompanyRepository = {
  async get() {
    return clone(company());
  },
  async update(input) {
    const errors = validateCompanySettings(input);
    if (Object.keys(errors).length) return invalid(errors);
    const next = { ...clone(input), setup: company().setup, updatedAt: now() };
    setCompany(next);
    return { ok: true, value: clone(next) };
  },
  async completeSetup() {
    setCompany({ ...company(), setup: { completedAt: now() } });
    return clone(company());
  },
  async resetDemo() {
    setCompany(clone(SAMPLE_COMPANY));
    return clone(company());
  },
};

/** The read-only store view used by shipping, tax and invoices. */
export function storeView(): StoreSettings {
  const c = company();
  return {
    storeName: c.storeName,
    email: c.contact.email,
    phone: c.contact.phone,
    address: clone(c.contact.address),
    currency: c.locale.currencyCode,
    timeZone: c.locale.timeZone,
    weightUnit: c.locale.weightUnit,
    dimensionUnit: c.locale.dimensionUnit,
    updatedAt: c.updatedAt,
  };
}

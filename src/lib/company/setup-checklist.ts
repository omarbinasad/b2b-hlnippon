/** Which setup steps look finished, for the setup wizard. Pure and tested. */
import type { CompanySettings } from "../types/company.ts";

export interface SetupFacts {
  zones: number;
  taxEnabled: boolean;
  taxRates: number;
  paymentsEnabled: number;
  groups: number;
  livePages: number;
  posts: number;
}

export interface SetupStepStatus {
  key: string;
  title: string;
  done: boolean;
  /** What is done, or what is still needed. */
  detail: string;
  /** Where to fix it; steps edited inside the wizard have none. */
  href?: string;
}

const isSampleAddress = (s: CompanySettings) => /\(sample\)/i.test(s.contact.address.addressLine1);
const isSampleEmail = (s: CompanySettings) => /@example\.(com|org|net)$/i.test(s.contact.email);

export function setupChecklist(s: CompanySettings, f: SetupFacts): SetupStepStatus[] {
  const b = s.branding;
  const contactNeeds = [isSampleEmail(s) && "a real contact email", isSampleAddress(s) && "a real address"].filter(Boolean);
  const brandNeeds = [!b.logoMain && "a logo", !b.favicon && "a favicon"].filter(Boolean);
  const taxReady = !f.taxEnabled || f.taxRates > 0;
  return [
    { key: "company", title: "Company information", done: contactNeeds.length === 0, detail: contactNeeds.length ? `Still needs ${contactNeeds.join(" and ")}.` : "Company and contact details are set." },
    { key: "branding", title: "Branding", done: brandNeeds.length === 0, detail: brandNeeds.length ? `Still needs ${brandNeeds.join(" and ")}.` : "Logo and favicon are set." },
    { key: "location", title: "Currency and location", done: true, detail: `${s.locale.country}, ${s.locale.currencyCode}, ${s.locale.timeZone}.` },
    { key: "store", title: "Store configuration", done: true, detail: `Weights in ${s.locale.weightUnit}, dimensions in ${s.locale.dimensionUnit}.` },
    { key: "shipping", title: "Shipping", done: f.zones > 0, detail: f.zones ? `${f.zones} shipping zones.` : "No shipping zones yet.", href: "/admin/shipping" },
    { key: "tax", title: "Tax", done: taxReady, detail: !f.taxEnabled ? "Tax is off. Turn it on if it applies to you." : f.taxRates ? `Tax is on with ${f.taxRates} rates.` : "Tax is on, but no rates exist.", href: "/admin/tax" },
    { key: "payments", title: "Payment methods", done: f.paymentsEnabled > 0, detail: f.paymentsEnabled ? `${f.paymentsEnabled} enabled.` : "No payment method is enabled.", href: "/admin/payments" },
    { key: "b2b", title: "B2B accounts and pricing", done: f.groups > 0, detail: f.groups ? `${f.groups} customer groups.` : "No customer groups yet.", href: "/admin/customer-groups" },
    { key: "content", title: "Website content", done: f.livePages > 0, detail: f.livePages ? `${f.livePages} live pages and ${f.posts} posts. Replace sample content before launch.` : "No live pages yet.", href: "/admin/pages" },
  ];
}

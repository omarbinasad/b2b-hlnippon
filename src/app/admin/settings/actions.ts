"use server";

/*
 * Company settings mutations. DEMO: kept in server memory only. TODO(auth): the permission ("settings.manage") is
 * mocked; the backend must authorize the call.
 */
import { revalidatePath } from "next/cache";
import { getAdminActor } from "@/lib/auth/session";
import { repositories } from "@/lib/data";
import type { BrandImage, CompanySettingsInput, FieldErrors, SocialLink } from "@/lib/types";

export type SettingsActionResult = { ok: true } | { ok: false; errors: FieldErrors; message: string };

const denied: SettingsActionResult = { ok: false, errors: {}, message: "You don't have permission to change settings (mock permission)." };

const str = (v: unknown, max = 200) => (typeof v === "string" ? v.slice(0, max) : "");
const opt = (v: unknown, max = 200) => str(v, max).trim() || undefined;
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});

/** Only site-relative paths: a logo can't point at another site. */
function image(v: unknown): BrandImage | null {
  const o = obj(v);
  const url = str(o.url, 300);
  if (!/^\/(?!\/)[\w./-]+$/.test(url)) return null;
  const n = (x: unknown) => (typeof x === "number" && x > 0 && x <= 20000 ? Math.round(x) : 0);
  return { url, width: n(o.width) || 400, height: n(o.height) || 120 };
}

const DIGITS = [0, 2, 3] as const;
const WEEK = [0, 1, 2, 3, 4, 5, 6] as const;
const NETWORKS = ["facebook", "instagram", "x", "linkedin", "youtube", "tiktok", "line", "website"] as const;

function coerce(raw: unknown): CompanySettingsInput {
  const v = obj(raw);
  const b = obj(v.branding);
  const c = obj(v.contact);
  const a = obj(c.address);
  const m = obj(c.map);
  const d = obj(v.documents);
  const l = obj(v.locale);
  const lat = Number(m.lat);
  const lng = Number(m.lng);
  const country = str(l.country, 2).toUpperCase();
  return {
    companyName: str(v.companyName, 120).trim(),
    legalName: opt(v.legalName, 160),
    storeName: str(v.storeName, 100).trim(),
    tagline: opt(v.tagline, 200),
    description: opt(v.description, 500),
    registrationNumber: opt(v.registrationNumber, 60),
    taxNumber: opt(v.taxNumber, 60),
    branding: {
      logoMain: image(b.logoMain),
      logoLight: image(b.logoLight),
      logoDark: image(b.logoDark),
      logoMobile: image(b.logoMobile),
      favicon: image({ url: b.favicon })?.url ?? null,
      primaryColor: str(b.primaryColor, 7),
      secondaryColor: str(b.secondaryColor, 7),
      accentColor: str(b.accentColor, 7),
      headingFont: str(b.headingFont, 40),
      bodyFont: str(b.bodyFont, 40),
      buttonStyle: b.buttonStyle === "pill" || b.buttonStyle === "square" ? b.buttonStyle : "rounded",
    },
    contact: {
      email: str(c.email).trim(),
      phone: str(c.phone, 40).trim(),
      whatsapp: opt(c.whatsapp, 40),
      hours: opt(c.hours, 120),
      address: {
        addressLine1: str(a.addressLine1).trim(),
        addressLine2: opt(a.addressLine2),
        area: opt(a.area),
        city: str(a.city, 100).trim(),
        prefecture: str(a.prefecture, 60).trim(),
        postalCode: str(a.postalCode, 12).trim(),
        country,
      },
      map: Number.isFinite(lat) && Number.isFinite(lng) && m.lat !== "" && m.lng !== "" && m.lat !== undefined ? { lat, lng, label: opt(m.label, 120) ?? "Our location" } : undefined,
      social: (Array.isArray(c.social) ? c.social : []).slice(0, 12).map((s): SocialLink => {
        const o = obj(s);
        return { network: NETWORKS.find((n) => n === o.network) ?? "website", url: str(o.url, 300).trim() };
      }),
    },
    documents: { invoiceTitle: opt(d.invoiceTitle, 60), invoicePrefix: opt(d.invoicePrefix, 10)?.toUpperCase(), invoiceHeaderNote: opt(d.invoiceHeaderNote, 300), showLogoOnInvoice: d.showLogoOnInvoice === true, showRegistrationOnInvoice: d.showRegistrationOnInvoice === true, showTaxNumberOnInvoice: d.showTaxNumberOnInvoice === true, attachInvoicePdf: d.attachInvoicePdf === true, emailInvoiceOnIssue: d.emailInvoiceOnIssue === true, invoiceFooter: opt(d.invoiceFooter, 500), emailSenderName: opt(d.emailSenderName, 100), emailFooter: opt(d.emailFooter, 500) },
    locale: {
      country,
      currencyCode: str(l.currencyCode, 3).toUpperCase(),
      currencySymbol: str(l.currencySymbol, 8).trim(),
      currencyDigits: DIGITS.find((x) => x === l.currencyDigits) ?? (-1 as 0),
      symbolPosition: l.symbolPosition === "after" ? "after" : "before",
      numberLocale: str(l.numberLocale, 20).trim(),
      dateLocale: str(l.dateLocale, 20).trim(),
      language: str(l.language, 20).trim(),
      timeZone: str(l.timeZone, 60).trim(),
      weekStartsOn: WEEK.find((x) => x === l.weekStartsOn) ?? 0,
      weightUnit: l.weightUnit === "g" ? "g" : "kg",
      dimensionUnit: l.dimensionUnit === "mm" ? "mm" : l.dimensionUnit === "m" ? "m" : "cm",
    },
  };
}

async function actor() {
  const a = await getAdminActor();
  return a.permissions.includes("company.manage") ? { id: a.id, name: a.name, role: a.role } : null;
}

/** Branding and locale affect every page. */
const refreshAll = () => revalidatePath("/", "layout");

export async function updateCompanySettingsAction(raw: unknown): Promise<SettingsActionResult> {
  const by = await actor();
  if (!by) return denied;
  const result = await repositories.company.update(coerce(raw), by);
  if (!result.ok) return { ok: false, errors: result.errors, message: result.message ?? "Some fields need attention." };
  refreshAll();
  return { ok: true };
}

/** Invoice settings: a role with "invoices.manage" can change these without being able to change the rest of the company. */
export async function updateInvoiceSettingsAction(raw: unknown): Promise<SettingsActionResult> {
  const a = await getAdminActor();
  if (!a.permissions.includes("invoices.manage")) return denied;
  const { documents } = coerce(raw);
  const result = await repositories.company.update({ ...(await repositories.company.get()), documents }, { id: a.id, name: a.name, role: a.role });
  if (!result.ok) return { ok: false, errors: result.errors, message: result.message ?? "Some fields need attention." };
  refreshAll();
  return { ok: true };
}

export async function completeSetupAction(): Promise<SettingsActionResult> {
  const by = await actor();
  if (!by) return denied;
  await repositories.company.completeSetup(by);
  refreshAll();
  return { ok: true };
}

export async function resetDemoCompanyAction(): Promise<SettingsActionResult> {
  if (!(await actor())) return denied;
  await repositories.company.resetDemo();
  refreshAll();
  return { ok: true };
}

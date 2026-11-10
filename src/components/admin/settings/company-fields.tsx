"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateCompanySettingsAction } from "@/app/admin/settings/actions";
import { MediaPicker } from "@/components/admin/media/media-picker";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/feedback";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Icon } from "@/components/ui/icons";
import { RegionField } from "@/components/ui/region-field";
import { contrastOn, FONT_OPTIONS } from "@/lib/branding/css";
import { originCountries } from "@/lib/countries";
import { applyCountry, CURRENCIES } from "@/lib/locale-presets";
import { addressLabels } from "@/lib/locations";
import type { BrandImage, CompanyContact, CompanySettingsInput, FieldErrors, SocialNetwork } from "@/lib/types";

const NETWORK_LABELS: Record<SocialNetwork, string> = { facebook: "Facebook", instagram: "Instagram", x: "X", linkedin: "LinkedIn", youtube: "YouTube", tiktok: "TikTok", line: "LINE", website: "Website" };
const WEEK_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** One editable copy of the settings, shared by the settings pages and the setup wizard. */
export function useCompanyDraft(initial: CompanySettingsInput, saveAction: typeof updateCompanySettingsAction = updateCompanySettingsAction) {
  const [draft, setDraft] = useState(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState("");
  const [pending, startTransition] = useTransition();
  const save = (after?: () => void, onErrors?: (e: FieldErrors) => void) =>
    startTransition(async () => {
      const r = await saveAction(draft);
      if (r.ok) {
        setErrors({});
        setStatus("Saved to the demo store.");
        after?.();
      } else {
        setErrors(r.errors);
        setStatus(r.message);
        onErrors?.(r.errors);
      }
    });
  return { draft, setDraft, errors, status, pending, save };
}
export type CompanyDraft = ReturnType<typeof useCompanyDraft>;

function TextField({ id, label, value, onChange, error, required, hint, type, placeholder }: { id: string; label: string; value: string | undefined; onChange: (v: string) => void; error?: string; required?: boolean; hint?: string; type?: string; placeholder?: string }) {
  return (
    <Field id={id} label={label} required={required} error={error} hint={hint}>
      <Input id={id} type={type ?? "text"} value={value ?? ""} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined} />
    </Field>
  );
}

export function CompanyInfoFields({ form }: { form: CompanyDraft }) {
  const { draft: v, setDraft: set, errors: e } = form;
  return (
    <Card title="Company information" description="Your business details. The store name appears in the header, browser tab and emails.">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField id="co-company" label="Company name" required value={v.companyName} error={e.companyName} onChange={(x) => set({ ...v, companyName: x })} />
        <TextField id="co-legal" label="Legal business name" value={v.legalName} hint="Shown on invoices when set." onChange={(x) => set({ ...v, legalName: x })} />
        <TextField id="co-store" label="Store name" required value={v.storeName} error={e.storeName} onChange={(x) => set({ ...v, storeName: x })} />
        <TextField id="co-tagline" label="Tagline" value={v.tagline} error={e.tagline} onChange={(x) => set({ ...v, tagline: x })} />
        <div className="sm:col-span-2">
          <Field id="co-description" label="Business description" error={e.description} hint="Used in the footer and search results.">
            <Textarea id="co-description" rows={3} value={v.description ?? ""} onChange={(x) => set({ ...v, description: x.target.value })} />
          </Field>
        </div>
        <TextField id="co-reg" label="Business registration number" value={v.registrationNumber} onChange={(x) => set({ ...v, registrationNumber: x })} />
        <TextField id="co-tax" label="Tax registration number" value={v.taxNumber} onChange={(x) => set({ ...v, taxNumber: x })} />
      </div>
    </Card>
  );
}

export function ContactFields({ form }: { form: CompanyDraft }) {
  const { draft: v, setDraft: set, errors: e } = form;
  const c = v.contact;
  const setC = (patch: Partial<CompanyContact>) => set({ ...v, contact: { ...c, ...patch } });
  const setA = (patch: Partial<CompanyContact["address"]>) => setC({ address: { ...c.address, ...patch } });
  const country = v.locale.country;
  const labels = addressLabels(country);
  return (
    <Card title="Contact and address" description="Shown in the footer, on the contact page and on invoices.">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField id="co-email" label="Contact email" type="email" required value={c.email} error={e["contact.email"]} onChange={(x) => setC({ email: x })} />
        <TextField id="co-phone" label="Contact phone" type="tel" required value={c.phone} error={e["contact.phone"]} onChange={(x) => setC({ phone: x })} />
        <TextField id="co-whatsapp" label="WhatsApp number" type="tel" value={c.whatsapp} error={e["contact.whatsapp"]} placeholder="+81 90 0000 0000" onChange={(x) => setC({ whatsapp: x })} />
        <TextField id="co-hours" label="Business hours" value={c.hours} onChange={(x) => setC({ hours: x })} />
        <div className="sm:col-span-2"><TextField id="co-line1" label="Street address" required value={c.address.addressLine1} error={e["contact.address.addressLine1"]} onChange={(x) => setA({ addressLine1: x })} /></div>
        <div className="sm:col-span-2"><TextField id="co-line2" label="Building, floor, landmark" value={c.address.addressLine2} onChange={(x) => setA({ addressLine2: x })} /></div>
        <TextField id="co-area" label="Area / town" value={c.address.area} onChange={(x) => setA({ area: x })} />
        <TextField id="co-city" label="City" required value={c.address.city} error={e["contact.address.city"]} onChange={(x) => setA({ city: x })} />
        <Field id="co-region" label={labels.region} required error={e["contact.address.prefecture"]}>
          <RegionField id="co-region" country={country} value={c.address.prefecture} onChange={(x) => setA({ prefecture: x.target.value })} aria-invalid={Boolean(e["contact.address.prefecture"])} aria-describedby={e["contact.address.prefecture"] ? "co-region-error" : undefined} />
        </Field>
        <TextField id="co-postcode" label={labels.postcode} required value={c.address.postalCode} error={e["contact.address.postalCode"]} onChange={(x) => setA({ postalCode: x })} />
        <TextField id="co-lat" label="Map latitude" value={c.map ? String(c.map.lat) : ""} error={e["contact.map"]} hint="Leave both empty for no map." onChange={(x) => setC({ map: x === "" && !c.map?.lng ? undefined : { lat: x as unknown as number, lng: c.map?.lng ?? (0 as number), label: c.map?.label ?? "Our location" } })} />
        <TextField id="co-lng" label="Map longitude" value={c.map ? String(c.map.lng) : ""} onChange={(x) => setC({ map: x === "" && !c.map?.lat ? undefined : { lat: c.map?.lat ?? 0, lng: x as unknown as number, label: c.map?.label ?? "Our location" } })} />
      </div>
      <fieldset className="mt-5">
        <legend className="text-sm font-medium">Social links</legend>
        <ul className="mt-2 space-y-2">
          {c.social.map((s, i) => (
            <li key={i} className="grid gap-2 sm:grid-cols-[10rem_minmax(0,1fr)_auto]">
              <Select aria-label={`Network ${i + 1}`} value={s.network} onChange={(x) => setC({ social: c.social.map((o, j) => (j === i ? { ...o, network: x.target.value as SocialNetwork } : o)) })}>
                {Object.entries(NETWORK_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </Select>
              <div>
                <Input aria-label={`Link ${i + 1}`} placeholder="https://" value={s.url} aria-invalid={Boolean(e[`contact.social.${i}`])} onChange={(x) => setC({ social: c.social.map((o, j) => (j === i ? { ...o, url: x.target.value } : o)) })} />
                {e[`contact.social.${i}`] && <p className="mt-1 text-xs text-danger">{e[`contact.social.${i}`]}</p>}
              </div>
              <Button variant="ghost" aria-label={`Remove link ${i + 1}`} onClick={() => setC({ social: c.social.filter((_, j) => j !== i) })}><Icon name="trash" className="size-4" /></Button>
            </li>
          ))}
        </ul>
        <Button variant="secondary" size="sm" className="mt-2" onClick={() => setC({ social: [...c.social, { network: "website", url: "" }] })}><Icon name="plus" className="size-4" /> Add link</Button>
      </fieldset>
    </Card>
  );
}

function ImageField({ label, hint, value, onChange }: { label: string; hint: string; value: BrandImage | null; onChange: (v: BrandImage | null) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-ui border border-line p-3">
      <p className="text-sm font-medium">{label}</p>
      <p className="text-xs text-muted">{hint}</p>
      <div className="mt-2 grid h-20 place-items-center overflow-hidden rounded-ui bg-surface-muted p-2">
        {value ? <Image src={value.url} alt="" width={value.width} height={value.height} unoptimized={value.url.startsWith("/media/")} className="max-h-16 w-auto object-contain" /> : <span className="text-xs text-muted">Not set</span>}
      </div>
      <div className="mt-2 flex gap-2">
        <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>Choose</Button>
        {value && <Button size="sm" variant="ghost" onClick={() => onChange(null)}>Remove</Button>}
      </div>
      <MediaPicker open={open} onClose={() => setOpen(false)} title={label} onSelect={(m) => { onChange({ url: m.url, width: m.width ?? 400, height: m.height ?? 120 }); setOpen(false); }} />
    </div>
  );
}

function ColorField({ id, label, hint, value, error, onChange }: { id: string; label: string; hint: string; value: string; error?: string; onChange: (v: string) => void }) {
  return (
    <Field id={id} label={label} error={error} hint={hint}>
      <div className="flex items-center gap-2">
        <input type="color" aria-label={`${label} picker`} value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : "#000000"} onChange={(e) => onChange(e.target.value)} className="h-10 w-12 shrink-0 cursor-pointer rounded-ui border border-line bg-surface p-1" />
        <Input id={id} value={value} maxLength={7} onChange={(e) => onChange(e.target.value)} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : `${id}-hint`} />
      </div>
    </Field>
  );
}

export function BrandingFields({ form }: { form: CompanyDraft }) {
  const { draft: v, setDraft: set, errors: e } = form;
  const b = v.branding;
  const setB = (patch: Partial<typeof b>) => set({ ...v, branding: { ...b, ...patch } });
  const radius = b.buttonStyle === "pill" ? "9999px" : b.buttonStyle === "square" ? "0.25rem" : "0.75rem";
  return (
    <>
      <Card title="Logos" description="Square or wide images work best. A missing logo falls back to the main logo, and with no logos the store name shows as text.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <ImageField label="Main logo" hint="The default everywhere." value={b.logoMain} onChange={(x) => setB({ logoMain: x })} />
          <ImageField label="Light logo" hint="On light backgrounds." value={b.logoLight} onChange={(x) => setB({ logoLight: x })} />
          <ImageField label="Dark logo" hint="On dark backgrounds and the admin sidebar." value={b.logoDark} onChange={(x) => setB({ logoDark: x })} />
          <ImageField label="Mobile logo" hint="In the store header on phones." value={b.logoMobile} onChange={(x) => setB({ logoMobile: x })} />
          <ImageField label="Favicon" hint="The browser tab icon. Use a small square image." value={b.favicon ? { url: b.favicon, width: 64, height: 64 } : null} onChange={(x) => setB({ favicon: x?.url ?? null })} />
        </div>
      </Card>
      <Card title="Colors and type" description="Applied across the store, customer portal and admin. Dark mode uses a lighter version automatically.">
        <div className="grid gap-4 sm:grid-cols-3">
          <ColorField id="co-primary" label="Primary color" hint="Buttons, links, charts." value={b.primaryColor} error={e["branding.primaryColor"]} onChange={(x) => setB({ primaryColor: x })} />
          <ColorField id="co-secondary" label="Secondary color" hint="Admin sidebar, home hero." value={b.secondaryColor} error={e["branding.secondaryColor"]} onChange={(x) => setB({ secondaryColor: x })} />
          <ColorField id="co-accent" label="Accent color" hint="Call-to-action buttons, badges." value={b.accentColor} error={e["branding.accentColor"]} onChange={(x) => setB({ accentColor: x })} />
          <Field id="co-heading" label="Heading font" error={e["branding.headingFont"]}>
            <Select id="co-heading" value={b.headingFont} onChange={(x) => setB({ headingFont: x.target.value })}>{FONT_OPTIONS.map((f) => <option key={f.name}>{f.name}</option>)}</Select>
          </Field>
          <Field id="co-body" label="Body font" error={e["branding.bodyFont"]}>
            <Select id="co-body" value={b.bodyFont} onChange={(x) => setB({ bodyFont: x.target.value })}>{FONT_OPTIONS.map((f) => <option key={f.name}>{f.name}</option>)}</Select>
          </Field>
          <Field id="co-button" label="Button shape">
            <Select id="co-button" value={b.buttonStyle} onChange={(x) => setB({ buttonStyle: x.target.value as typeof b.buttonStyle })}>
              <option value="rounded">Rounded</option>
              <option value="pill">Pill</option>
              <option value="square">Square</option>
            </Select>
          </Field>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-ui border border-line p-4" aria-label="Color preview">
          <span className="text-xs font-medium text-muted">Preview</span>
          {[["Primary", b.primaryColor], ["Secondary", b.secondaryColor], ["Accent", b.accentColor]].map(([name, color]) =>
            /^#[0-9a-fA-F]{6}$/.test(color) ? (
              <span key={name} className="px-4 py-2 text-sm font-medium" style={{ background: color, color: contrastOn(color), borderRadius: radius }}>{name}</span>
            ) : null,
          )}
        </div>
      </Card>
    </>
  );
}

export function DocumentBrandingFields({ form }: { form: CompanyDraft }) {
  const { draft: v, setDraft: set } = form;
  const d = v.documents;
  return (
    <Card title="Invoice and email branding" description="Used on invoices and in email templates. The invoice logo is the main logo.">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField id="co-sender" label="Email sender name" value={d.emailSenderName} onChange={(x) => set({ ...v, documents: { ...d, emailSenderName: x } })} />
        <div className="sm:col-span-2">
          <Field id="co-invoice-footer" label="Invoice footer"><Textarea id="co-invoice-footer" rows={2} value={d.invoiceFooter ?? ""} onChange={(x) => set({ ...v, documents: { ...d, invoiceFooter: x.target.value } })} /></Field>
        </div>
        <div className="sm:col-span-2">
          <Field id="co-email-footer" label="Email footer"><Textarea id="co-email-footer" rows={2} value={d.emailFooter ?? ""} onChange={(x) => set({ ...v, documents: { ...d, emailFooter: x.target.value } })} /></Field>
        </div>
      </div>
    </Card>
  );
}

export function LocaleFields({ form, savedCurrency }: { form: CompanyDraft; savedCurrency: string }) {
  const { draft: v, setDraft: set, errors: e } = form;
  const l = v.locale;
  const setL = (patch: Partial<typeof l>) => set({ ...v, locale: { ...l, ...patch } });
  const zones = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [l.timeZone];
  return (
    <>
      <Card title="Country and currency" description="Choosing a country fills in suggestions you can still change.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="co-country" label="Country" required error={e["locale.country"]}>
            <Select
              id="co-country"
              value={l.country}
              onChange={(x) => {
                const country = x.target.value;
                set({ ...v, locale: applyCountry(l, country), contact: { ...v.contact, address: { ...v.contact.address, country } } });
              }}
            >
              {originCountries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
            </Select>
          </Field>
          <Field id="co-currency" label="Currency" required error={e["locale.currencyCode"]}>
            <Select
              id="co-currency"
              value={l.currencyCode}
              onChange={(x) => {
                const c = CURRENCIES.find((o) => o.code === x.target.value);
                setL(c ? { currencyCode: c.code, currencySymbol: c.symbol, currencyDigits: c.digits } : { currencyCode: x.target.value });
              }}
            >
              {!CURRENCIES.some((c) => c.code === l.currencyCode) && <option value={l.currencyCode}>{l.currencyCode}</option>}
              {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code} · {c.name}</option>)}
            </Select>
          </Field>
          <TextField id="co-symbol" label="Currency symbol" required value={l.currencySymbol} error={e["locale.currencySymbol"]} onChange={(x) => setL({ currencySymbol: x })} />
          <Field id="co-digits" label="Decimals" error={e["locale.currencyDigits"]} hint="How many decimals an amount may have.">
            <Select id="co-digits" value={String(l.currencyDigits)} onChange={(x) => setL({ currencyDigits: Number(x.target.value) as 0 | 2 | 3 })}>
              <option value="0">0 (e.g. 1,000)</option>
              <option value="2">2 (e.g. 1,000.50)</option>
              <option value="3">3 (e.g. 1,000.500)</option>
            </Select>
          </Field>
          <Field id="co-position" label="Symbol position">
            <Select id="co-position" value={l.symbolPosition} onChange={(x) => setL({ symbolPosition: x.target.value === "after" ? "after" : "before" })}>
              <option value="before">Before the amount</option>
              <option value="after">After the amount</option>
            </Select>
          </Field>
        </div>
        {l.currencyCode !== savedCurrency && (
          <div className="mt-4">
            <Notice tone="warning" title="Amounts are not converted">
              Changing from {savedCurrency} to {l.currencyCode} only changes how amounts are labelled: 1,000 stays 1,000, now in {l.currencyCode}. On a live store, changing currency needs a backend data migration and new prices.
            </Notice>
          </div>
        )}
      </Card>
      <Card title="Language, dates and time" description="How numbers and dates appear, and which time zone cut-offs use.">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField id="co-number-locale" label="Number format" required hint="Locale tag, e.g. ja-JP or en-US." value={l.numberLocale} error={e["locale.numberLocale"]} onChange={(x) => setL({ numberLocale: x })} />
          <TextField id="co-date-locale" label="Date format" required hint="Locale tag, e.g. en-GB gives 1 Sept 2026." value={l.dateLocale} error={e["locale.dateLocale"]} onChange={(x) => setL({ dateLocale: x })} />
          <TextField id="co-language" label="Page language" required hint="e.g. en. Interface text is in English." value={l.language} error={e["locale.language"]} onChange={(x) => setL({ language: x })} />
          <Field id="co-tz" label="Time zone" required error={e["locale.timeZone"]}>
            <Select id="co-tz" value={l.timeZone} onChange={(x) => setL({ timeZone: x.target.value })}>
              {!zones.includes(l.timeZone) && <option value={l.timeZone}>{l.timeZone}</option>}
              {zones.map((z) => <option key={z} value={z}>{z}</option>)}
            </Select>
          </Field>
          <Field id="co-week" label="Week starts on">
            <Select id="co-week" value={String(l.weekStartsOn)} onChange={(x) => setL({ weekStartsOn: Number(x.target.value) as typeof l.weekStartsOn })}>
              {WEEK_DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
            </Select>
          </Field>
        </div>
      </Card>
    </>
  );
}

export function UnitFields({ form }: { form: CompanyDraft }) {
  const { draft: v, setDraft: set, errors: e } = form;
  const l = v.locale;
  return (
    <Card title="Units" description="Default units for new products and how weights display.">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="co-weight" label="Weight unit" error={e["locale.weightUnit"]}>
          <Select id="co-weight" value={l.weightUnit} onChange={(x) => set({ ...v, locale: { ...l, weightUnit: x.target.value === "g" ? "g" : "kg" } })}>
            <option value="kg">Kilograms (kg)</option>
            <option value="g">Grams (g)</option>
          </Select>
        </Field>
        <Field id="co-dimension" label="Dimension unit" error={e["locale.dimensionUnit"]}>
          <Select id="co-dimension" value={l.dimensionUnit} onChange={(x) => set({ ...v, locale: { ...l, dimensionUnit: x.target.value as typeof l.dimensionUnit } })}>
            <option value="cm">Centimetres (cm)</option>
            <option value="mm">Millimetres (mm)</option>
            <option value="m">Metres (m)</option>
          </Select>
        </Field>
      </div>
    </Card>
  );
}

export function SaveBar({ form, label = "Save changes" }: { form: CompanyDraft; label?: string }) {
  const router = useRouter();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button type="submit" disabled={form.pending} onClick={() => form.save(() => router.refresh())}>{form.pending ? "Saving…" : label}</Button>
      <p role="status" className={Object.keys(form.errors).length ? "text-sm text-danger" : "text-sm text-muted"}>{form.status}</p>
    </div>
  );
}

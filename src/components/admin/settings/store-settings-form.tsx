"use client";

import { useState, useTransition } from "react";
import { updateStoreSettingsAction } from "@/app/admin/settings/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { JP_PREFECTURES } from "@/lib/locations";
import type { FieldErrors, StoreSettings } from "@/lib/types";
import { siteConfig } from "@/config/site";

export function StoreSettingsForm({ settings }: { settings: StoreSettings }) {
  const [v, setV] = useState({
    storeName: settings.storeName,
    email: settings.email ?? "",
    phone: settings.phone ?? "",
    weightUnit: settings.weightUnit,
    dimensionUnit: settings.dimensionUnit,
  });
  const [addr, setAddr] = useState({ ...settings.address, addressLine2: settings.address.addressLine2 ?? "", area: settings.address.area ?? "" });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState("");
  const [pending, startTransition] = useTransition();

  const text = (key: "storeName" | "email" | "phone", label: string, opts: { required?: boolean; type?: string; autoComplete?: string } = {}) => (
    <Field id={`st-${key}`} label={label} required={opts.required} error={errors[key]}>
      <Input id={`st-${key}`} type={opts.type ?? "text"} value={v[key]} onChange={(e) => setV({ ...v, [key]: e.target.value })} autoComplete={opts.autoComplete} aria-invalid={Boolean(errors[key])} aria-describedby={errors[key] ? `st-${key}-error` : undefined} />
    </Field>
  );
  const addrField = (key: "addressLine1" | "addressLine2" | "area" | "city" | "postalCode", label: string, required = false) => {
    const k = `address.${key}`;
    return (
      <Field id={`st-${key}`} label={label} required={required} error={errors[k]}>
        <Input id={`st-${key}`} value={addr[key]} onChange={(e) => setAddr({ ...addr, [key]: e.target.value })} inputMode={key === "postalCode" ? "numeric" : undefined} aria-invalid={Boolean(errors[k])} aria-describedby={errors[k] ? `st-${key}-error` : undefined} />
      </Field>
    );
  };

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const result = await updateStoreSettingsAction({ ...v, address: addr });
          if (result.ok) {
            setErrors({});
            setStatus("Saved to the demo store.");
          } else {
            setErrors(result.errors);
            setStatus(result.message);
          }
        });
      }}
      className="space-y-6"
    >
      <Card title="Store">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">{text("storeName", "Store name", { required: true, autoComplete: "organization" })}</div>
          {text("email", "Email", { type: "email", autoComplete: "email" })}
          {text("phone", "Phone", { type: "tel", autoComplete: "tel" })}
        </div>
        <p className="mt-3 text-xs text-muted">The storefront header still reads the brand name from the site configuration; this name is used in admin and shipping settings.</p>
      </Card>

      <Card title="Store location" description="Where orders ship from. This is separate from each product's country of origin.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">{addrField("addressLine1", "House / road / street", true)}</div>
          <div className="sm:col-span-2">{addrField("addressLine2", "Building, floor, landmark")}</div>
          {addrField("area", "Town / 町域")}
          {addrField("city", "City", true)}
          <Field id="st-prefecture" label="Prefecture" required error={errors["address.prefecture"]}>
            <Select id="st-prefecture" value={addr.prefecture} onChange={(e) => setAddr({ ...addr, prefecture: e.target.value })}>
              {JP_PREFECTURES.map((d) => <option key={d} value={d}>{d}</option>)}
            </Select>
          </Field>
          {addrField("postalCode", "Postcode", true)}
          <Field id="st-country" label="Country" hint="Japan only in this version.">
            <Input id="st-country" value="Japan" disabled aria-describedby="st-country-hint" />
          </Field>
        </div>
      </Card>

      <Card title="Currency, time zone and units">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="st-currency" label="Currency" hint="Fixed: JPY (¥), whole yen. Changing currency needs a backend migration.">
            <Input id="st-currency" value={`${settings.currency} (${siteConfig.currencySymbol})`} disabled aria-describedby="st-currency-hint" />
          </Field>
          <Field id="st-tz" label="Time zone" hint="Fixed: dates, sale schedules and cutoffs use store time.">
            <Input id="st-tz" value={settings.timeZone} disabled aria-describedby="st-tz-hint" />
          </Field>
          <Field id="st-weight" label="Weight unit" hint="Default for new products and weight displays." error={errors.weightUnit}>
            <Select id="st-weight" value={v.weightUnit} onChange={(e) => setV({ ...v, weightUnit: e.target.value as "kg" | "g" })} aria-describedby="st-weight-hint">
              <option value="kg">Kilograms (kg)</option>
              <option value="g">Grams (g)</option>
            </Select>
          </Field>
          <Field id="st-dims" label="Dimension unit" hint="Default for new products." error={errors.dimensionUnit}>
            <Select id="st-dims" value={v.dimensionUnit} onChange={(e) => setV({ ...v, dimensionUnit: e.target.value as "cm" | "mm" | "m" })} aria-describedby="st-dims-hint">
              <option value="cm">Centimetres (cm)</option>
              <option value="mm">Millimetres (mm)</option>
              <option value="m">Metres (m)</option>
            </Select>
          </Field>
        </div>
        <p className="mt-3 text-xs text-muted">Existing products keep the units they were saved with. Shipping weight tiers always calculate in grams internally.</p>
      </Card>

      <div className="flex items-center justify-end gap-3">
        <p role="status" className="text-sm text-muted">{status}</p>
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save settings"}</Button>
      </div>
    </form>
  );
}

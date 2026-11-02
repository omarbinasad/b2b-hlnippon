"use client";

import { useState, useTransition } from "react";
import { lookupPostcodeAction, saveAddressAction } from "@/app/admin/customers/actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { JP_PREFECTURES } from "@/lib/locations";
import type { Address, AddressInput, FieldErrors, PostcodeLookup } from "@/lib/types";
import { isPostcode } from "@/lib/customers/contact";

const blank: AddressInput = {
  type: "shipping",
  label: "",
  recipientName: "",
  companyName: "",
  country: "JP",
  prefecture: "",
  city: "",
  area: "",
  postalCode: "",
  addressLine1: "",
  addressLine2: "",
  phone: "",
  isDefault: false,
};

/** Japanese address: 7-digit postcode → prefecture → city (市区町村) → optional town (町域) → street and building. */
export function AddressForm({
  customerId,
  address,
  defaults,
  onDone,
}: {
  customerId: string;
  address?: Address;
  /** Prefill for new addresses (e.g. business name and contact). */
  defaults?: Partial<AddressInput>;
  onDone: () => void;
}) {
  const [values, setValues] = useState<AddressInput>(() => (address ? { ...blank, ...address } : { ...blank, ...defaults }));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState("");
  const [lookup, setLookup] = useState<PostcodeLookup | null>(null);
  const [saving, startSaving] = useTransition();
  const [looking, startLookup] = useTransition();
  const p = address ? `addr-${address.id}` : "addr-new";
  const set = <K extends keyof AddressInput>(key: K, value: AddressInput[K]) => setValues((v) => ({ ...v, [key]: value }));

  const text = (key: "label" | "recipientName" | "companyName" | "phone" | "addressLine1" | "addressLine2" | "area" | "city", label: string, opts: { required?: boolean; hint?: string; wide?: boolean; autoComplete?: string } = {}) => {
    const id = `${p}-${key}`;
    return (
      <div className={opts.wide ? "sm:col-span-2" : undefined}>
        <Field id={id} label={label} required={opts.required} hint={opts.hint} error={errors[key]}>
          <Input
            id={id}
            value={values[key] ?? ""}
            onChange={(e) => set(key, e.target.value)}
            maxLength={200}
            autoComplete={opts.autoComplete ?? "off"}
            inputMode={key === "phone" ? "tel" : undefined}
            aria-invalid={Boolean(errors[key])}
            aria-describedby={errors[key] ? `${id}-error` : opts.hint ? `${id}-hint` : undefined}
          />
        </Field>
      </div>
    );
  };

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        startSaving(async () => {
          const result = await saveAddressAction(customerId, values);
          if (result.ok) onDone();
          else {
            setErrors(result.errors);
            setMessage(result.message);
          }
        });
      }}
      className="space-y-4"
    >
      <fieldset>
        <legend className="text-sm font-medium">Address type</legend>
        <div className="mt-1.5 flex gap-4 text-sm">
          {(["shipping", "billing"] as const).map((t) => (
            <label key={t} className="inline-flex items-center gap-2">
              <input type="radio" name={`${p}-type`} checked={values.type === t} onChange={() => set("type", t)} className="accent-brand" />
              {t === "shipping" ? "Delivery" : "Billing"}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-2">
        {text("label", "Label", { required: true, hint: "e.g. Main shop, Central kitchen" })}
        {text("recipientName", "Recipient name", { required: true, autoComplete: "name" })}
        {text("companyName", "Company", { autoComplete: "organization" })}
        {text("phone", "Phone", { required: true, autoComplete: "tel" })}
        {text("addressLine1", "House / road / street", { required: true, wide: true, autoComplete: "address-line1" })}
        {text("addressLine2", "Building, floor, landmark", { wide: true, autoComplete: "address-line2" })}
      </div>

      <div className="space-y-2 rounded-ui border border-line p-3">
        <div className="flex items-end gap-2">
          <div className="w-36">
            <Field id={`${p}-postalCode`} label="Postcode" required error={errors.postalCode}>
              <Input
                id={`${p}-postalCode`}
                inputMode="numeric"
                maxLength={4}
                value={values.postalCode}
                onChange={(e) => {
                  set("postalCode", e.target.value.replace(/\D/g, ""));
                  setLookup(null);
                }}
                aria-invalid={Boolean(errors.postalCode)}
                aria-describedby={errors.postalCode ? `${p}-postalCode-error` : `${p}-lookup-status`}
              />
            </Field>
          </div>
          <Button
            variant="secondary"
            disabled={!isPostcode(values.postalCode) || looking}
            onClick={() => startLookup(async () => setLookup(await lookupPostcodeAction(values.postalCode)))}
          >
            {looking ? "Looking up…" : "Look up"}
          </Button>
        </div>
        <div id={`${p}-lookup-status`} role="status" className="text-xs">
          {!lookup && <p className="text-muted">Optional: suggests prefecture, city and area from a small sample dataset. You choose whether to use it.</p>}
          {lookup?.status === "not_found" && (
            <p className="text-muted">
              {lookup.postalCode} isn&apos;t in the sample lookup data ({lookup.datasetSize} postcodes only). That doesn&apos;t mean it&apos;s wrong —
              enter the area, city and prefecture yourself.
            </p>
          )}
          {lookup?.status === "found" && (
            <div className="space-y-1.5">
              <p className="text-muted">Sample data suggests (check before using):</p>
              <ul className="space-y-1.5">
                {lookup.matches.map((m) => (
                  <li key={`${m.postOffice}-${m.area}`} className="flex flex-wrap items-center gap-2">
                    <span>
                      {m.postOffice} post office · {m.area}, {m.city}, {m.prefecture} prefecture
                    </span>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setValues((v) => ({ ...v, area: m.area, city: m.city, prefecture: m.prefecture }))}
                    >
                      Use this
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {text("area", "Town / 町域 (optional)")}
        {text("city", "City", { required: true })}
        <Field id={`${p}-prefecture`} label="Prefecture" required error={errors.prefecture}>
          <Select
            id={`${p}-prefecture`}
            value={values.prefecture}
            onChange={(e) => set("prefecture", e.target.value)}
            aria-invalid={Boolean(errors.prefecture)}
            aria-describedby={errors.prefecture ? `${p}-prefecture-error` : undefined}
          >
            <option value="">Choose…</option>
            {JP_PREFECTURES.map((d) => <option key={d} value={d}>{d}</option>)}
          </Select>
        </Field>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={values.isDefault} onChange={(e) => set("isDefault", e.target.checked)} className="size-4 accent-brand" />
        Default {values.type === "shipping" ? "delivery" : "billing"} address
      </label>

      <p role="alert" className="text-sm text-danger">{message}</p>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onDone}>Cancel</Button>
        <Button type="submit" disabled={saving}>{saving ? "Saving…" : address ? "Save address" : "Add address"}</Button>
      </div>
    </form>
  );
}

"use client";

import { Field, Input, Select } from "@/components/ui/field";
import { formatAddressLines } from "@/lib/format";
import { JP_PREFECTURES, prefectureLabel } from "@/lib/locations";
import type { Address, FieldErrors, OrderAddressInput } from "@/lib/types";

export const emptyAddress: OrderAddressInput = {
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
};

export const toAddressInput = (a: Address): OrderAddressInput => ({
  recipientName: a.recipientName,
  companyName: a.companyName ?? "",
  country: a.country,
  prefecture: a.prefecture,
  city: a.city,
  area: a.area ?? "",
  postalCode: a.postalCode,
  addressLine1: a.addressLine1,
  addressLine2: a.addressLine2 ?? "",
  phone: a.phone,
});

const fields: { key: keyof OrderAddressInput; label: string; required?: boolean; wide?: boolean; autoComplete?: string }[] = [
  { key: "recipientName", label: "Recipient name", required: true, autoComplete: "name" },
  { key: "phone", label: "Phone", required: true, autoComplete: "tel" },
  { key: "companyName", label: "Company", wide: true, autoComplete: "organization" },
  { key: "postalCode", label: "Postcode / 郵便番号", required: true, autoComplete: "postal-code" },
  { key: "prefecture", label: "Prefecture / 都道府県", required: true, autoComplete: "address-level1" },
  { key: "area", label: "Town / 町域", autoComplete: "address-level3" },
  { key: "city", label: "City / 市区町村", required: true, autoComplete: "address-level2" },
  { key: "addressLine1", label: "Street address", required: true, wide: true, autoComplete: "address-line1" },
  { key: "addressLine2", label: "Building, floor (optional)", wide: true, autoComplete: "address-line2" },
];

/** Pick one of the customer's saved addresses, then edit it for this order only. */
export function AddressEditor({
  id,
  legend,
  saved,
  value,
  onChange,
  errors,
  errorPrefix,
  phoneOptional = false,
}: {
  id: string;
  legend: string;
  saved: Address[];
  value: OrderAddressInput;
  onChange: (a: OrderAddressInput) => void;
  errors: FieldErrors;
  errorPrefix: string;
  /** Walk-in orders: the phone may be left empty. */
  phoneOptional?: boolean;
}) {
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-semibold">{legend}</legend>
      {saved.length > 0 && (
        <Field id={`${id}-saved`} label="Start from a saved address" hint="Edits here apply to this order only; the customer's address book is unchanged.">
          <Select
            id={`${id}-saved`}
            defaultValue=""
            onChange={(e) => {
              const a = saved.find((x) => x.id === e.target.value);
              if (a) onChange(toAddressInput(a));
            }}
            aria-describedby={`${id}-saved-hint`}
          >
            <option value="" disabled>Choose…</option>
            {saved.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label} ({a.type}) — {formatAddressLines(a)[0]}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map((f) => {
          const fieldId = `${id}-${f.key}`;
          const error = errors[`${errorPrefix}.${f.key}`];
          return (
            <div key={f.key} className={f.wide ? "sm:col-span-2" : undefined}>
              <Field id={fieldId} label={f.key === "phone" && phoneOptional ? "Phone (optional)" : f.label} required={f.required && !(f.key === "phone" && phoneOptional)} error={error}>
                {f.key === "prefecture" ? (
                  <Select
                    id={fieldId}
                    value={value.prefecture}
                    onChange={(e) => onChange({ ...value, prefecture: e.target.value })}
                    autoComplete={f.autoComplete}
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? `${fieldId}-error` : undefined}
                  >
                    <option value="">Choose…</option>
                    {/* Keeps an older free-text value selectable until it is changed. */}
                    {value.prefecture && !JP_PREFECTURES.includes(value.prefecture as (typeof JP_PREFECTURES)[number]) && <option value={value.prefecture}>{value.prefecture}</option>}
                    {JP_PREFECTURES.map((p) => <option key={p} value={p}>{prefectureLabel(p)}</option>)}
                  </Select>
                ) : (
                  <Input
                    id={fieldId}
                    value={value[f.key] ?? ""}
                    onChange={(e) => onChange({ ...value, [f.key]: e.target.value })}
                    autoComplete={f.autoComplete ?? "off"}
                    inputMode={f.key === "postalCode" ? "numeric" : f.key === "phone" ? "tel" : undefined}
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? `${fieldId}-error` : undefined}
                  />
                )}
              </Field>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}

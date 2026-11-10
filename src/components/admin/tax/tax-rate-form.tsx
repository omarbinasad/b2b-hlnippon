"use client";

import { addressLabels, regionNames, storeCountry } from "@/lib/locations";
import { useState, useTransition } from "react";
import { saveTaxRateAction } from "@/app/admin/tax/actions";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { RegionField } from "@/components/ui/region-field";
import { validateTaxRate } from "@/lib/tax/engine";
import type { FieldErrors, TaxClassOption, TaxLocation, TaxRate } from "@/lib/types";

export function TaxRateForm({ rate, others, classes }: { rate?: TaxRate; others: TaxRate[]; classes: TaxClassOption[] }) {
  const [name, setName] = useState(rate?.name ?? "");
  const [percent, setPercent] = useState(rate ? String(rate.percent) : "");
  const [taxClass, setTaxClass] = useState(rate?.taxClass ?? "standard");
  const [enabled, setEnabled] = useState(rate?.enabled ?? true);
  const [type, setType] = useState<TaxLocation["type"]>(rate?.location.type ?? "country");
  const [prefecture, setPrefecture] = useState(rate && (rate.location.type === "prefecture" || rate.location.type === "city") ? rate.location.prefecture : regionNames()[0] ?? "");
  const [city, setCity] = useState(rate?.location.type === "city" ? rate.location.city : "");
  const [postalCode, setPostalCode] = useState(rate?.location.type === "postcode" ? rate.location.postalCode : "");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  const location = (): TaxLocation =>
    type === "postcode" ? { type, postalCode } : type === "city" ? { type, prefecture, city } : type === "prefecture" ? { type, prefecture } : { type: "country", country: storeCountry() };

  const submit = () => {
    const input = { name, percent: percent.trim() === "" ? Number.NaN : Number(percent), taxClass, location: location(), enabled };
    const local = validateTaxRate(input, others, classes.map((c) => c.id));
    if (Object.keys(local).length) {
      setErrors(local);
      setMessage("Some fields need attention.");
      return;
    }
    startTransition(async () => {
      const result = await saveTaxRateAction(rate?.id ?? null, input);
      if (!result) return;
      if (!result.ok) {
        setErrors(result.errors);
        setMessage(result.message);
      }
    });
  };

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="space-y-6"
    >
      <Card title="Rate">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field id="rate-name" label="Name" required hint="Shown on previews and order tax lines. Demo rates should say they are fictional." error={errors.name}>
              <Input id="rate-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? "rate-name-error" : "rate-name-hint"} />
            </Field>
          </div>
          <Field id="rate-percent" label="Rate (%)" required hint="0–100, up to 2 decimals. 0 = zero-rated." error={errors.percent}>
            <Input id="rate-percent" type="number" inputMode="decimal" min={0} max={100} step="0.01" value={percent} onChange={(e) => setPercent(e.target.value)} aria-invalid={Boolean(errors.percent)} aria-describedby={errors.percent ? "rate-percent-error" : "rate-percent-hint"} />
          </Field>
          <Field id="rate-class" label="Tax class" required error={errors.taxClass}>
            <Select id="rate-class" value={taxClass} onChange={(e) => setTaxClass(e.target.value as TaxRate["taxClass"])} aria-invalid={Boolean(errors.taxClass)}>
              {classes.map((c) => <option key={c.id} value={c.id} disabled={c.id === "exempt"}>{c.name}{c.id === "exempt" ? " (never taxed)" : ""}</option>)}
            </Select>
          </Field>
        </div>
        <label className="mt-4 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="size-4 accent-brand" />
          Enabled
        </label>
      </Card>

      <Card title="Applies to" description="Most specific wins: postcode > city > prefecture > country. A country-wide rate is the fallback for its class.">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field id="rate-loc-type" label="Location">
            <Select id="rate-loc-type" value={type} onChange={(e) => setType(e.target.value as TaxLocation["type"])}>
              <option value="country">Whole country (fallback)</option>
              <option value="prefecture">{addressLabels().region}</option>
              <option value="city">City</option>
              <option value="postcode">{addressLabels().postcode}</option>
            </Select>
          </Field>
          {(type === "prefecture" || type === "city") && (
            <Field id="rate-prefecture" label={addressLabels().region}>
              <RegionField id="rate-prefecture" value={prefecture} onChange={(e) => setPrefecture(e.target.value)} />
            </Field>
          )}
          {type === "city" && (
            <Field id="rate-city" label="City">
              <Input id="rate-city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Gazipur" />
            </Field>
          )}
          {type === "postcode" && (
            <Field id="rate-postcode" label={addressLabels().postcode}>
              <Input id="rate-postcode" inputMode="numeric" maxLength={4} value={postalCode} onChange={(e) => setPostalCode(e.target.value.replace(/\D/g, ""))} />
            </Field>
          )}
        </div>
        {errors.location && <p role="alert" className="mt-2 text-xs text-danger">{errors.location}</p>}
      </Card>

      <p role="alert" className="text-sm text-danger">{message}</p>
      <div className="flex flex-wrap justify-end gap-2">
        <ButtonLink href="/admin/tax" variant="secondary">Cancel</ButtonLink>
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : rate ? "Save rate" : "Create rate"}</Button>
      </div>
    </form>
  );
}

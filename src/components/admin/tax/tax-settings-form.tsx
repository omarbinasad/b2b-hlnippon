"use client";

import { useState, useTransition } from "react";
import { updateTaxSettingsAction } from "@/app/admin/tax/actions";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/field";
import type { FieldErrors, TaxClassOption, TaxSettings } from "@/lib/types";

export function TaxSettingsForm({ settings, classes }: { settings: TaxSettings; classes: TaxClassOption[] }) {
  const [v, setV] = useState({
    enabled: settings.enabled,
    pricesIncludeTax: settings.pricesIncludeTax,
    shippingTaxable: settings.shippingTaxable,
    shippingTaxClass: settings.shippingTaxClass,
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const result = await updateTaxSettingsAction(v);
          if (result.ok) {
            setErrors({});
            setStatus("Saved. New orders and previews use these settings; existing orders keep their snapshot.");
          } else {
            setErrors(result.errors);
            setStatus(result.message);
          }
        });
      }}
      className="space-y-5"
    >
      <label className="flex items-start gap-3 rounded-ui border border-line p-3 has-checked:border-brand has-checked:bg-brand-soft">
        <input type="checkbox" checked={v.enabled} onChange={(e) => setV({ ...v, enabled: e.target.checked })} className="mt-0.5 size-4 accent-brand" />
        <span>
          <span className="block text-sm font-medium">Calculate tax</span>
          <span className="block text-xs text-muted">Off: no tax on previews or new orders.</span>
        </span>
      </label>

      <fieldset disabled={!v.enabled} className="space-y-5 disabled:opacity-60">
        <div>
          <p className="text-sm font-medium">Entered prices</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {[
              { value: false, label: "Exclude tax", help: "Tax is added on top of catalog and agreed prices." },
              { value: true, label: "Include tax", help: "Prices already contain tax; it is extracted, the total does not change." },
            ].map((o) => (
              <label key={String(o.value)} className="flex cursor-pointer gap-3 rounded-ui border border-line p-3 has-checked:border-brand has-checked:bg-brand-soft">
                <input type="radio" name="prices-include-tax" checked={v.pricesIncludeTax === o.value} onChange={() => setV({ ...v, pricesIncludeTax: o.value })} className="mt-0.5 accent-brand" />
                <span>
                  <span className="block text-sm font-medium">{o.label}</span>
                  <span className="block text-xs text-muted">{o.help}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={v.shippingTaxable} onChange={(e) => setV({ ...v, shippingTaxable: e.target.checked })} className="size-4 accent-brand" />
            Shipping charges are taxable
          </label>
          <Field id="tax-ship-class" label="Shipping tax class" hint="The rate matched for this class at the delivery address applies to shipping." error={errors.shippingTaxClass}>
            <Select id="tax-ship-class" value={v.shippingTaxClass} onChange={(e) => setV({ ...v, shippingTaxClass: e.target.value as TaxSettings["shippingTaxClass"] })} disabled={!v.shippingTaxable} aria-describedby="tax-ship-class-hint" className="sm:w-64">
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center justify-end gap-3">
        <p role="status" className="text-sm text-muted">{status}</p>
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save tax settings"}</Button>
      </div>
    </form>
  );
}

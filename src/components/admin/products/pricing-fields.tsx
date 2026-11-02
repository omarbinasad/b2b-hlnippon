"use client";

import type { FieldErrors } from "@/lib/types";
import { Checkbox, DateField, fieldId, MoneyField } from "./form-fields";

export interface PricingValue {
  basePrice: string;
  salePrice: string;
  saleScheduled: boolean;
  saleFrom: string;
  saleTo: string;
}

/** Regular price, optional sale price and optional sale schedule. `prefix` is "" or "variations.N.". */
export function PricingFields({
  prefix,
  errors,
  value,
  onChange,
  priceRequired,
}: {
  prefix: string;
  errors: FieldErrors;
  value: PricingValue;
  onChange: (patch: Partial<PricingValue>) => void;
  priceRequired: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <MoneyField path={`${prefix}basePrice`} label="Regular price (excl. tax)" errors={errors} required={priceRequired} value={value.basePrice} onChange={(basePrice) => onChange({ basePrice })} />
        <MoneyField path={`${prefix}salePrice`} label="Sale price (excl. tax)" errors={errors} hint="Optional. Lower than the regular price." value={value.salePrice} onChange={(salePrice) => onChange({ salePrice })} />
      </div>
      <Checkbox
        id={`${fieldId(prefix || "pricing")}-schedule`}
        label="Schedule the sale"
        hint="Without dates the sale price applies until removed."
        checked={value.saleScheduled}
        onChange={(saleScheduled) => onChange({ saleScheduled })}
      />
      {value.saleScheduled && (
        <div className="grid gap-3 sm:grid-cols-2">
          <DateField path={`${prefix}saleFrom`} label="Sale starts" errors={errors} value={value.saleFrom} max={value.saleTo} rangeStart={value.saleFrom} rangeEnd={value.saleTo} onChange={(saleFrom) => onChange({ saleFrom })} />
          <DateField path={`${prefix}saleTo`} label="Sale ends" errors={errors} value={value.saleTo} min={value.saleFrom} rangeStart={value.saleFrom} rangeEnd={value.saleTo} onChange={(saleTo) => onChange({ saleTo })} />
        </div>
      )}
    </div>
  );
}

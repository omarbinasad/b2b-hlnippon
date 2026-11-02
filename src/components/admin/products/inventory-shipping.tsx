"use client";

import { stockOptions } from "@/lib/enums";
import type { ShippingClass } from "@/lib/types";
import type { SectionProps } from "./draft";
import { Checkbox, DimensionsFields, fieldId, Section, SelectField, TextField } from "./form-fields";

export const backorderLabels = { no: "Do not allow", notify: "Allow, but notify the customer", allow: "Allow" } as const;
export const manualStockOptions = stockOptions.filter((o) => o.value !== "low_stock");

/** Product-level inventory (for variable products: the shared stock variations can use). */
export function InventorySection({ draft, update, errors, storeThreshold }: SectionProps & { storeThreshold: number }) {
  const variable = draft.type === "variable";
  return (
    <Section
      id="section-inventory"
      title="Inventory"
      description={variable ? "Product-level stock. Variations set to “Same as product” share this quantity; others keep their own." : undefined}
    >
      <Checkbox
        id={fieldId("manageStock")}
        label="Track stock quantity"
        hint="When off, set the stock status by hand."
        checked={draft.manageStock}
        onChange={(manageStock) => update({ manageStock })}
      />
      <div className="grid gap-4 sm:grid-cols-3">
        {draft.manageStock ? (
          <>
            <TextField path="stockQuantity" label="Quantity" errors={errors} required inputMode="numeric" value={draft.stockQuantity} onChange={(stockQuantity) => update({ stockQuantity })} />
            <SelectField path="backorders" label="Backorders" errors={errors} value={draft.backorders} onChange={(v) => update({ backorders: v as typeof draft.backorders })}>
              {Object.entries(backorderLabels).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
            </SelectField>
            <TextField path="lowStockThreshold" label="Low-stock threshold" errors={errors} inputMode="numeric" placeholder={`Store-wide threshold (${storeThreshold})`} hint="Leave empty to use the store-wide threshold." value={draft.lowStockThreshold} onChange={(lowStockThreshold) => update({ lowStockThreshold })} />
          </>
        ) : (
          <SelectField path="stockStatus" label="Stock status" errors={errors} value={draft.stockStatus} onChange={(s) => update({ stockStatus: s as typeof draft.stockStatus })}>
            {manualStockOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </SelectField>
        )}
      </div>
      <Checkbox
        id={fieldId("soldIndividually")}
        label="Sold individually"
        hint="Limit purchases to one unit per order."
        checked={draft.soldIndividually}
        onChange={(soldIndividually) => update({ soldIndividually })}
      />
      <fieldset className="rounded-ui border border-dashed border-line p-3">
        <legend className="px-1 text-sm font-medium">Imported from the old store (optional)</legend>
        <p className="mb-3 text-xs text-muted">Kept as-is for reference during migration; not used in any stock or price calculation.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField path="initialStock" label="Initial number in stock" errors={errors} inputMode="numeric" value={draft.initialStock} onChange={(initialStock) => update({ initialStock })} />
          <TextField path="unitOfMeasure" label="Unit of measurement" errors={errors} maxLength={50} value={draft.unitOfMeasure} onChange={(unitOfMeasure) => update({ unitOfMeasure })} />
        </div>
      </fieldset>
      <p className="text-xs text-muted">
        Minimum/maximum order quantities and increments will be managed by the Rules module (not part of this form).
      </p>
    </Section>
  );
}

export function ShippingSection({ draft, update, errors, shippingClasses }: SectionProps & { shippingClasses: ShippingClass[] }) {
  return (
    <Section
      id="section-shipping"
      title="Shipping"
      description={draft.type === "variable" ? "Defaults for all variations; a variation can override weight, dimensions and class." : undefined}
    >
      <div className="grid gap-4 sm:grid-cols-[1fr_6rem_1fr]">
        <TextField path="weight" label="Weight" errors={errors} required inputMode="decimal" value={draft.weightValue} onChange={(weightValue) => update({ weightValue })} />
        <SelectField path="weightUnit" label="Unit" errors={errors} value={draft.weightUnit} onChange={(u) => update({ weightUnit: u as "g" | "kg" })}>
          <option value="kg">kg</option>
          <option value="g">g</option>
        </SelectField>
        <SelectField path="shippingClassId" label="Shipping class" errors={errors} hint="Rates are set in shipping settings (coming later)." value={draft.shippingClassId} onChange={(shippingClassId) => update({ shippingClassId })}>
          <option value="">No shipping class</option>
          {shippingClasses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </SelectField>
      </div>
      <DimensionsFields path="dimensions" errors={errors} value={draft.dims} onChange={(dims) => update({ dims })} />
      <Checkbox
        id={fieldId("isVariableWeight")}
        label="Priced by weight"
        hint="For items like fresh meat: the final price is adjusted to the packed weight after ordering."
        checked={draft.isVariableWeight}
        onChange={(isVariableWeight) => update({ isVariableWeight })}
      />
    </Section>
  );
}

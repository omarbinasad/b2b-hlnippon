"use client";

import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { Icon } from "@/components/ui/icons";
import { cx } from "@/lib/cx";
import { formatMoney } from "@/lib/format";
import type { FieldErrors, ShippingClass, TaxClassOption } from "@/lib/types";
import { parseNum, type AttributeDraft, type ImageDraft, type VariationDraft } from "./draft";
import { a11y, Checkbox, DimensionsFields, fieldId, SelectField, TextField } from "./form-fields";
import { backorderLabels, manualStockOptions } from "./inventory-shipping";
import { ImageManager } from "./image-manager";
import { PricingFields } from "./pricing-fields";

/** Parent values shown as "Same as product (…)". */
export interface ParentSummary {
  manageStock: boolean;
  backorders: keyof typeof backorderLabels;
  weight: string;
  dimensions: string;
  shippingClass: string;
  taxClass: string;
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-3">
      <legend className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">{title}</legend>
      {children}
    </fieldset>
  );
}

interface VariationRowProps {
  v: VariationDraft;
  index: number;
  errors: FieldErrors;
  attributes: AttributeDraft[];
  images: ImageDraft[];
  parent: ParentSummary;
  shippingClasses: ShippingClass[];
  taxClasses: TaxClassOption[];
  publishing: boolean;
  open: boolean;
  onToggle: (open: boolean) => void;
  onChange: (patch: Partial<VariationDraft>) => void;
  onRemove: () => void;
}

export function VariationRow({ v, index, errors, attributes, images, parent, shippingClasses, taxClasses, publishing, open, onToggle, onChange, onRemove }: VariationRowProps) {
  const p = `variations.${index}.`;
  const hasError = Object.keys(errors).some((k) => k.startsWith(p));
  const label = attributes.map((a) => v.attributes[a.name]).filter(Boolean).join(" · ") || "New variation — choose options";
  const price = parseNum(v.basePrice);
  const unpriced = v.status === "active" && v.basePrice.trim() === "";
  const descA11y = a11y(`${p}description`, errors);

  return (
    <details open={open} onToggle={(e) => onToggle(e.currentTarget.open)} className={cx("group rounded-ui border bg-surface", hasError ? "border-danger" : "border-line")}>
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 [&::-webkit-details-marker]:hidden">
        <Icon name="chevronRight" className="size-4 shrink-0 text-muted transition-transform group-open:rotate-90" />
        <span className="min-w-0 flex-1 font-medium">{label}</span>
        <span className="text-xs text-muted">{v.sku || "No SKU"}</span>
        <span className="text-sm tabular-nums">{price !== undefined && Number.isFinite(price) ? formatMoney(price) : "—"}</span>
        {v.status === "disabled" && <Badge>Disabled</Badge>}
        {unpriced && <Badge tone="warning">No price — can&apos;t be purchased</Badge>}
        {hasError && <Badge tone="danger">Needs attention</Badge>}
      </summary>

      <div className="space-y-6 border-t border-line p-3 sm:p-4">
        <Group title="Options & identity">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {attributes.length === 0 && <p className="text-sm text-muted">Mark an attribute “Used for variations” first.</p>}
            {attributes.map((a, ai) => (
              <SelectField
                key={a.key}
                path={ai === 0 ? `${p}attributes` : `${p}attributes.${a.name}`}
                label={a.name}
                errors={ai === 0 ? errors : {}}
                required
                value={v.attributes[a.name] ?? ""}
                onChange={(val) => onChange({ attributes: { ...v.attributes, [a.name]: val } })}
              >
                <option value="">Choose…</option>
                {a.values.map((val) => <option key={val} value={val}>{val}</option>)}
              </SelectField>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <TextField path={`${p}sku`} label="SKU" errors={errors} required value={v.sku} onChange={(sku) => onChange({ sku })} autoComplete="off" />
            <TextField path={`${p}gtin`} label="GTIN / barcode" errors={errors} hint="Optional" inputMode="numeric" value={v.gtin} onChange={(gtin) => onChange({ gtin })} autoComplete="off" />
            <div className="self-end pb-2">
              <Checkbox
                id={`${fieldId(p)}enabled`}
                label="Enabled"
                hint="Disabled options can't be ordered."
                checked={v.status === "active"}
                onChange={(on) => onChange({ status: on ? "active" : "disabled" })}
              />
            </div>
          </div>
        </Group>

        <Group title="Pricing">
          {unpriced && (
            <p role="note" className="rounded-ui bg-warning-soft px-3 py-2 text-sm text-warning">
              This variation is enabled but has no price, so customers can&apos;t buy it.
            </p>
          )}
          <PricingFields prefix={p} errors={errors} value={v} onChange={onChange} priceRequired={publishing && v.status === "active"} />
        </Group>

        <Group title="Inventory">
          <div className="grid gap-3 sm:grid-cols-3">
            <SelectField path={`${p}stockMode`} label="Stock" errors={errors} value={v.stockMode} onChange={(m) => onChange({ stockMode: m as VariationDraft["stockMode"] })}>
              <option value="parent">Same as product (shared stock)</option>
              <option value="track">Track own quantity</option>
              <option value="status">Set stock status</option>
            </SelectField>
            {v.stockMode === "track" && (
              <>
                <TextField path={`${p}stockQuantity`} label="Quantity" errors={errors} required inputMode="numeric" value={v.stockQuantity} onChange={(stockQuantity) => onChange({ stockQuantity })} />
                <SelectField path={`${p}backorders`} label="Backorders" errors={errors} value={v.backorders} onChange={(b) => onChange({ backorders: b as VariationDraft["backorders"] })}>
                  <option value="">Same as product ({backorderLabels[parent.backorders]})</option>
                  {Object.entries(backorderLabels).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </SelectField>
              </>
            )}
            {v.stockMode === "status" && (
              <SelectField path={`${p}stockStatus`} label="Stock status" errors={errors} value={v.stockStatus} onChange={(s) => onChange({ stockStatus: s as VariationDraft["stockStatus"] })}>
                {manualStockOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </SelectField>
            )}
            {v.stockMode === "parent" && (
              <p className="self-end pb-2 text-sm text-muted sm:col-span-2">
                {parent.manageStock ? "Uses the product-level quantity in Inventory." : "The product doesn't track stock — turn it on in Inventory."}
              </p>
            )}
          </div>
        </Group>

        <Group title="Shipping & tax">
          <div className="space-y-3">
            <Checkbox id={`${fieldId(p)}override-weight`} label="Different weight" hint={`Same as product: ${parent.weight}`} checked={v.overrideWeight} onChange={(overrideWeight) => onChange({ overrideWeight })} />
            {v.overrideWeight && (
              <div className="grid grid-cols-[1fr_6rem] gap-3 sm:max-w-sm">
                <TextField path={`${p}weight`} label="Weight" errors={errors} required inputMode="decimal" value={v.weightValue} onChange={(weightValue) => onChange({ weightValue })} />
                <SelectField path={`${p}weightUnit`} label="Unit" errors={errors} value={v.weightUnit} onChange={(u) => onChange({ weightUnit: u as "g" | "kg" })}>
                  <option value="kg">kg</option>
                  <option value="g">g</option>
                </SelectField>
              </div>
            )}
            <Checkbox id={`${fieldId(p)}override-dims`} label="Different dimensions" hint={`Same as product: ${parent.dimensions}`} checked={v.overrideDimensions} onChange={(overrideDimensions) => onChange({ overrideDimensions })} />
            {v.overrideDimensions && <DimensionsFields path={`${p}dimensions`} errors={errors} value={v.dims} onChange={(dims) => onChange({ dims })} />}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <SelectField path={`${p}shippingClassId`} label="Shipping class" errors={errors} value={v.shippingClassId} onChange={(shippingClassId) => onChange({ shippingClassId })}>
              <option value="">Same as product ({parent.shippingClass})</option>
              {shippingClasses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </SelectField>
            <SelectField path={`${p}taxClass`} label="Tax class" errors={errors} value={v.taxClass} onChange={(t) => onChange({ taxClass: t as VariationDraft["taxClass"] })}>
              <option value="">Same as product ({parent.taxClass})</option>
              {taxClasses.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </SelectField>
          </div>
        </Group>

        <Group title="Images & description">
          <div>
            <p className="mb-1.5 text-sm font-medium">Variation image</p>
            <ImageManager images={v.ownImage} onChange={(ownImage) => onChange({ ownImage })} errors={errors} path={`${p}image`} fieldId={fieldId} single />
            <p className="mt-1 text-xs text-muted">
              {v.ownImage.length ? "This image is used for this option only." : "Upload an image for this option, or pick one from the product gallery below."}
            </p>
          </div>
          {images.length === 0 ? (
            <p className="text-sm text-muted">No product gallery images to choose from yet.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <SelectField path={`${p}imageKey`} label="Main image from gallery" errors={errors} hint={v.ownImage.length ? "Not used while a variation image is uploaded." : undefined} value={v.imageKey} onChange={(imageKey) => onChange({ imageKey, galleryKeys: v.galleryKeys.filter((k) => k !== imageKey) })}>
                <option value="">Same as product</option>
                {images.map((img, ii) => <option key={img.key} value={img.key}>Image {ii + 1}{img.alt ? ` — ${img.alt}` : ""}</option>)}
              </SelectField>
              <fieldset>
                <legend className="mb-1.5 text-sm font-medium">Gallery</legend>
                <div className="flex flex-wrap gap-2">
                  {images.filter((img) => img.key !== v.imageKey).map((img) => (
                    <label key={img.key} className="inline-flex items-center gap-1.5 text-sm">
                      <input
                        type="checkbox"
                        className="size-4 accent-[var(--brand)]"
                        checked={v.galleryKeys.includes(img.key)}
                        onChange={(e) => onChange({ galleryKeys: e.target.checked ? [...v.galleryKeys, img.key] : v.galleryKeys.filter((k) => k !== img.key) })}
                      />
                      Image {images.indexOf(img) + 1}
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
          )}
          <Field id={descA11y.id} label="Short description" error={errors[`${p}description`]}>
            <Textarea {...descA11y} rows={2} value={v.description} onChange={(e) => onChange({ description: e.target.value })} placeholder="Optional — shown when this option is selected" />
          </Field>
        </Group>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
          <p className="text-xs text-muted">{v.legacyWooId ? `Legacy WooCommerce ID ${v.legacyWooId}` : v.id ? `ID ${v.id}` : "New — not saved yet"}</p>
          <Button variant="ghost" size="sm" onClick={onRemove}>
            <Icon name="trash" className="size-4" /> Remove variation
          </Button>
        </div>
      </div>
    </details>
  );
}

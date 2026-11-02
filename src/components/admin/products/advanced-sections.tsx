"use client";

import { Field, Textarea } from "@/components/ui/field";
import { LIMITS } from "@/lib/validation/product";
import type { SectionProps } from "./draft";
import { a11y, Checkbox, fieldId, Section, TextField } from "./form-fields";
import { LinkedProductsField } from "./product-search";

export function LinkedProductsSection({ draft, update, errors, selfId }: SectionProps & { selfId?: string }) {
  return (
    <Section id="section-linked" title="Linked products" description="Optional. Products are found by a server search, so large catalogs stay fast.">
      <LinkedProductsField
        id={fieldId("upsellIds")}
        label="Upsells"
        description="Suggested on the product page instead of this one (e.g. a bigger pack or a better grade)."
        selected={draft.upsells}
        onChange={(upsells) => update({ upsells })}
        selfId={selfId}
        error={errors.upsellIds}
      />
      <LinkedProductsField
        id={fieldId("crossSellIds")}
        label="Cross-sells"
        description="Suggested in the cart alongside this product (e.g. spices with rice)."
        selected={draft.crossSells}
        onChange={(crossSells) => update({ crossSells })}
        selfId={selfId}
        error={errors.crossSellIds}
      />
    </Section>
  );
}

export function AdvancedSection({ draft, update, errors }: SectionProps) {
  const note = a11y("purchaseNote", errors, true);
  return (
    <Section id="section-advanced" title="Advanced">
      <Field id={note.id} label="Purchase note" error={errors.purchaseNote} hint={`Optional note shown to the customer after purchase (${draft.purchaseNote.length}/${LIMITS.purchaseNote}).`}>
        <Textarea {...note} rows={2} value={draft.purchaseNote} onChange={(e) => update({ purchaseNote: e.target.value })} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField path="menuOrder" label="Display order" errors={errors} inputMode="numeric" hint="Lower numbers appear first in manual sorting." value={draft.menuOrder} onChange={(menuOrder) => update({ menuOrder })} />
        <div className="sm:pt-7">
          <Checkbox id={fieldId("reviewsEnabled")} label="Enable reviews" hint="Allow customers to review this product (when reviews launch)." checked={draft.reviewsEnabled} onChange={(reviewsEnabled) => update({ reviewsEnabled })} />
        </div>
      </div>
      {draft.legacyWooId !== undefined && <p className="text-xs text-muted">Legacy WooCommerce ID: {draft.legacyWooId} (kept for migration mapping)</p>}
    </Section>
  );
}

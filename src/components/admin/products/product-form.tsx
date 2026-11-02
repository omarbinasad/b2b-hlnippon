"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { saveProductAction } from "@/app/admin/products/actions";
import { DemoEditingNotice } from "@/components/admin/demo-notice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/feedback";
import { Field, Textarea } from "@/components/ui/field";
import { Icon } from "@/components/ui/icons";
import { cx } from "@/lib/cx";
import { formatDateTime, humanize } from "@/lib/format";
import type { FieldErrors, Product, ProductPick } from "@/lib/types";
import { LIMITS, validateProduct } from "@/lib/validation/product";
import { AdvancedSection, LinkedProductsSection } from "./advanced-sections";
import { AttributesEditor } from "./attributes-editor";
import { autoSlug, draftFromProduct, draftToInput, withoutLocalImages, type FormOptions, type ProductDraft } from "./draft";
import { a11y, fieldId, Section, TextField } from "./form-fields";
import { ImageManager } from "./image-manager";
import { InventorySection, ShippingSection } from "./inventory-shipping";
import { PricingFields } from "./pricing-fields";
import { ProductPreview } from "./product-preview";
import { ProductEditActions } from "./edit-actions";
import { BrandsPanel, CategoriesPanel, OriginPanel, PublishPanel, TagsPanel, TaxPanel } from "./side-panels";
import { VariationsEditor } from "./variations-editor";

const UNIT_SUGGESTIONS = ["bag", "sack", "case", "pack", "pouch", "tin", "can", "bottle", "box", "piece"];

const LABELS: Record<string, string> = {
  name: "Name",
  slug: "Slug",
  sku: "SKU",
  gtin: "GTIN / barcode",
  shortDescription: "Short description",
  description: "Description",
  unitLabel: "Selling unit",
  categoryIds: "Categories",
  tags: "Tags",
  brandIds: "Brands",
  weight: "Weight",
  dimensions: "Dimensions",
  shippingClassId: "Shipping class",
  basePrice: "Regular price",
  salePrice: "Sale price",
  saleFrom: "Sale start",
  saleTo: "Sale end",
  stockQuantity: "Stock quantity",
  stockMode: "Stock",
  lowStockThreshold: "Low-stock threshold",
  initialStock: "Initial number in stock",
  menuOrder: "Display order",
  purchaseNote: "Purchase note",
  upsellIds: "Upsells",
  crossSellIds: "Cross-sells",
  attributes: "Attributes",
  variations: "Variations",
};

function labelFor(path: string, draft: ProductDraft) {
  if (LABELS[path]) return LABELS[path];
  const variation = /^variations\.(\d+)\.(\w+)/.exec(path);
  if (variation) {
    const v = draft.variations[Number(variation[1])];
    const options = v ? Object.values(v.attributes).filter(Boolean).join(" · ") : "";
    return `Variation ${Number(variation[1]) + 1}${options ? ` (${options})` : ""} — ${LABELS[variation[2]] ?? humanize(variation[2])}`;
  }
  const attribute = /^attributes\.(\d+)\.(\w+)/.exec(path);
  if (attribute) return `Attribute ${Number(attribute[1]) + 1} — ${attribute[2] === "values" ? "values" : "name"}`;
  const image = /^images\.(\d+)\.alt/.exec(path);
  if (image) return `Image ${Number(image[1]) + 1} — alt text`;
  const def = /^defaultAttributes\.(.+)$/.exec(path);
  if (def) return `Default ${def[1]}`;
  return humanize(path);
}

interface ProductFormProps {
  /** Omit to create a new product. */
  product?: Product;
  options: FormOptions;
  upsells?: ProductPick[];
  crossSells?: ProductPick[];
}

export function ProductForm({ product, options, upsells = [], crossSells = [] }: ProductFormProps) {
  const initial = () => draftFromProduct(product, { tags: options.tags, upsells, crossSells, units: options.units });
  const [draft, setDraft] = useState(initial);
  const [baseline, setBaseline] = useState(() => JSON.stringify(draftToInput(initial())));
  const [submitted, setSubmitted] = useState(false);
  const [serverErrors, setServerErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState<{ tone: "info" | "warning"; text: string } | null>(null);
  const [openKeys, setOpenKeys] = useState<string[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const summaryRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDialogElement>(null);

  const input = useMemo(() => draftToInput(draft), [draft]);
  const clientErrors = useMemo(() => (submitted ? validateProduct(input, product?.id) : {}), [submitted, input, product?.id]);
  const errors: FieldErrors = { ...serverErrors, ...clientErrors };
  const errorEntries = Object.entries(errors);
  const dirty = JSON.stringify(input) !== baseline;
  const isNew = !product;
  const variable = draft.type === "variable";

  // Warn before leaving the page with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const update = (patch: Partial<ProductDraft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    if (Object.keys(serverErrors).length) setServerErrors({});
  };
  const sectionProps = { draft, update, errors };

  /** Opens variation rows that contain errors and moves focus to the error summary. */
  const reveal = (errs: FieldErrors) => {
    const rows = Object.keys(errs)
      .map((k) => /^variations\.(\d+)\./.exec(k)?.[1])
      .filter((i): i is string => i !== undefined)
      .map((i) => draft.variations[Number(i)]?.key)
      .filter(Boolean);
    setOpenKeys((keys) => [...new Set([...keys, ...rows])]);
    requestAnimationFrame(() => summaryRef.current?.focus());
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setMessage(null);
    const errs = validateProduct(input, product?.id);
    if (Object.keys(errs).length) {
      reveal(errs);
      return;
    }
    const localImages = [...draft.images, ...draft.variations.flatMap((v) => v.ownImage)].filter((i) => i.local).length;
    const snapshot = JSON.stringify(input);
    startTransition(async () => {
      const result = await saveProductAction(product?.id ?? null, withoutLocalImages(input, draft));
      if (!result) return; // creating redirects to the new product's edit page
      if (!result.ok) {
        setServerErrors(result.errors);
        setMessage({ tone: "warning", text: result.message });
        reveal(result.errors);
        return;
      }
      setBaseline(snapshot);
      setServerErrors({});
      setMessage({
        tone: "info",
        text: `Saved to the demo store at ${formatDateTime(result.savedAt)}.${
          localImages ? ` ${localImages} local image${localImages === 1 ? " was" : "s were"} not saved — uploads need the backend.` : ""
        }`,
      });
    });
  };

  const shippingName = options.shippingClasses.find((c) => c.id === draft.shippingClassId)?.name ?? "none";
  const dims = draft.dims;
  const parent = {
    manageStock: draft.manageStock,
    backorders: draft.backorders,
    weight: draft.weightValue ? `${draft.weightValue} ${draft.weightUnit}` : "not set",
    dimensions: dims.length && dims.width && dims.height ? `${dims.length} × ${dims.width} × ${dims.height} ${dims.unit}` : "none",
    shippingClass: shippingName,
    taxClass: options.taxClasses.find((t) => t.id === draft.taxClass)?.name ?? draft.taxClass,
  };

  const sections = [
    ["section-general", "General"],
    ...(variable ? [] : [["section-pricing", "Pricing"]]),
    ["section-inventory", "Inventory"],
    ["section-shipping", "Shipping"],
    ["section-attributes", "Attributes"],
    ...(variable ? [["section-variations", "Variations"]] : []),
    ["section-images", "Images"],
    ["section-linked", "Linked products"],
    ["section-advanced", "Advanced"],
  ];
  const statusLabel = pending ? "Saving…" : dirty ? "Unsaved changes" : isNew ? "Not saved yet" : "All changes saved";
  const shortDesc = a11y("shortDescription", errors, true);
  const longDesc = a11y("description", errors, true);

  return (
    <>
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <Link href="/admin/products" className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
          <Icon name="arrowLeft" className="size-4" /> Products
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{isNew ? "Add product" : "Edit product"}</h1>
          {!isNew && <Badge tone={product.status === "published" ? "success" : product.status === "draft" ? "warning" : "neutral"}>{humanize(product.status)}</Badge>}
        </div>
        {!isNew && <p className="mt-1 text-sm text-muted">{product.name} · {product.sku}</p>}
      </div>
      <ProductEditActions product={product} />
    </div>
    <form onSubmit={onSubmit} noValidate aria-busy={pending}>

      <div className="mb-4 space-y-3">
        <DemoEditingNotice images />
        {message && (
          <div role="status">
            <Notice tone={message.tone}>{message.text}</Notice>
          </div>
        )}
        {submitted && errorEntries.length > 0 && (
          <div ref={summaryRef} tabIndex={-1} role="alert" className="rounded-ui border border-danger bg-danger-soft p-4 text-sm">
            <h2 className="font-semibold text-danger">
              {errorEntries.length} {errorEntries.length === 1 ? "field needs" : "fields need"} attention before saving
            </h2>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {errorEntries.slice(0, 15).map(([path, msg]) => (
                <li key={path}>
                  <a
                    href={`#${fieldId(path)}`}
                    className="text-danger underline underline-offset-2"
                    onClick={(e) => {
                      e.preventDefault();
                      const el = document.getElementById(fieldId(path));
                      el?.scrollIntoView({ block: "center" });
                      el?.focus({ preventScroll: true });
                    }}
                  >
                    {labelFor(path, draft)}: {msg}
                  </a>
                </li>
              ))}
            </ul>
            {errorEntries.length > 15 && <p className="mt-1 text-danger">…and {errorEntries.length - 15} more.</p>}
          </div>
        )}
      </div>

      <nav aria-label="Form sections" className="scrollbar-none -mx-4 mb-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
        <ul className="flex gap-1.5">
          {sections.map(([id, label]) => (
            <li key={id} className="shrink-0">
              <a href={`#${id}`} className="inline-flex h-8 items-center rounded-full border border-line bg-surface px-3 text-sm text-muted hover:border-brand hover:text-foreground">
                {label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-4">
          <Section id="section-general" title="General">
            <TextField
              path="name"
              label="Name"
              errors={errors}
              required
              maxLength={LIMITS.name}
              value={draft.name}
              onChange={(name) => update({ name, ...(draft.slugEdited ? {} : { slug: autoSlug(name) }) })}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <TextField path="slug" label="Slug" errors={errors} required hint={`Web address: /shop/${draft.slug || "…"}`} value={draft.slug} onChange={(slug) => update({ slug, slugEdited: true })} autoComplete="off" />
                {draft.slugEdited && draft.name && draft.slug !== autoSlug(draft.name) && (
                  <button type="button" className="mt-1 text-xs font-medium text-brand hover:underline" onClick={() => update({ slug: autoSlug(draft.name), slugEdited: false })}>
                    Generate from name
                  </button>
                )}
              </div>
              <TextField path="unitLabel" label="Selling unit" errors={errors} required list="unit-suggestions" hint="e.g. bag, case, tin" value={draft.unitLabel} onChange={(unitLabel) => update({ unitLabel })} />
              <datalist id="unit-suggestions">
                {UNIT_SUGGESTIONS.map((u) => <option key={u} value={u} />)}
              </datalist>
              <TextField path="sku" label="SKU" errors={errors} required hint="Unique across all products and variations" value={draft.sku} onChange={(sku) => update({ sku })} autoComplete="off" />
              <TextField path="gtin" label="GTIN / barcode" errors={errors} hint="Optional — EAN, UPC or ISBN digits" inputMode="numeric" value={draft.gtin} onChange={(gtin) => update({ gtin })} autoComplete="off" />
            </div>
            <Field id={shortDesc.id} label="Short description" error={errors.shortDescription} hint={`${draft.shortDescription.length}/${LIMITS.shortDescription} — shown on product cards`}>
              <Textarea {...shortDesc} rows={2} value={draft.shortDescription} onChange={(e) => update({ shortDescription: e.target.value })} />
            </Field>
            <Field id={longDesc.id} label="Description" error={errors.description} hint="Full details shown on the product page">
              <Textarea {...longDesc} rows={6} value={draft.description} onChange={(e) => update({ description: e.target.value })} />
            </Field>
            <fieldset>
              <legend className="mb-2 text-sm font-medium">Product type</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                {([
                  ["simple", "Simple product", "One SKU, price and stock — e.g. a 25 kg sack."],
                  ["variable", "Variable product", "Options such as size, each with its own SKU, price and stock."],
                ] as const).map(([value, title, text]) => (
                  <label
                    key={value}
                    className={cx(
                      "flex cursor-pointer gap-3 rounded-ui border p-3 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-focus",
                      draft.type === value ? "border-brand bg-brand-soft" : "border-line",
                    )}
                  >
                    <input
                      type="radio"
                      name="product-type"
                      value={value}
                      checked={draft.type === value}
                      onChange={() =>
                        update({
                          type: value,
                          // Attributes become variation attributes by default when switching to variable.
                          attributes: draft.attributes.map((a) => ({ ...a, variation: value === "variable" ? a.variation || draft.type === "simple" : false })),
                        })
                      }
                      className="mt-1 accent-[var(--brand)]"
                    />
                    <span>
                      <span className="block text-sm font-semibold">{title}</span>
                      <span className="block text-xs text-muted">{text}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          </Section>

          {!variable && (
            <Section id="section-pricing" title="Pricing" description="Wholesale price per selling unit, excluding tax. Customer and group rules may change what each customer pays.">
              <PricingFields prefix="" errors={errors} value={draft} onChange={update} priceRequired={draft.status === "published"} />
            </Section>
          )}

          <InventorySection {...sectionProps} storeThreshold={options.lowStockThreshold} />
          <ShippingSection {...sectionProps} shippingClasses={options.shippingClasses} />

          <Section id="section-attributes" title="Attributes" description={variable ? "Options customers choose from, and extra product information." : "Product information such as grade or pack size."}>
            <AttributesEditor {...sectionProps} storeAttributes={options.attributes} />
          </Section>

          {variable && (
            <Section id="section-variations" title="Variations" description="Each enabled combination is sold with its own SKU, price and stock. Settings marked “Same as product” follow the product.">
              <VariationsEditor
                {...sectionProps}
                shippingClasses={options.shippingClasses}
                taxClasses={options.taxClasses}
                parent={parent}
                openKeys={openKeys}
                onToggle={(key, open) => setOpenKeys((keys) => (open ? [...new Set([...keys, key])] : keys.filter((k) => k !== key)))}
                onSetOpenKeys={setOpenKeys}
              />
            </Section>
          )}

          <Section id="section-images" title="Images" description="The first image is the main image; the rest form the gallery. Variations can use any of them.">
            <ImageManager images={draft.images} onChange={(images) => update({ images })} errors={errors} path="images" fieldId={fieldId} />
          </Section>

          <LinkedProductsSection {...sectionProps} selfId={product?.id} />
          <AdvancedSection {...sectionProps} />
        </div>

        <div className="min-w-0 space-y-4">
          <PublishPanel {...sectionProps} />
          <CategoriesPanel {...sectionProps} categories={options.categories} />
          <BrandsPanel {...sectionProps} brands={options.brands} />
          <TagsPanel {...sectionProps} tags={options.tags} />
          <OriginPanel {...sectionProps} />
          <TaxPanel {...sectionProps} taxClasses={options.taxClasses} />
        </div>
      </div>

      {/* Sticky action bar */}
      <div className="sticky bottom-0 z-20 -mx-4 mt-6 flex flex-wrap items-center gap-3 border-t border-line bg-surface/95 py-3 pr-18 pl-4 backdrop-blur sm:-mx-6 sm:pl-6 lg:-mx-8 lg:pl-8">
        <p className={cx("mr-auto text-sm", dirty ? "font-medium text-warning" : "text-muted")} aria-live="polite">
          {statusLabel}
        </p>
        <Button
          variant="secondary"
          onClick={() => {
            setPreviewOpen(true);
            previewRef.current?.showModal();
          }}
        >
          <Icon name="eye" className="size-4" /> Preview
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : isNew ? "Create product" : "Save changes"}
        </Button>
      </div>

      <dialog
        ref={previewRef}
        aria-labelledby="preview-title"
        onClose={() => setPreviewOpen(false)}
        className="m-auto max-h-[92vh] w-[min(64rem,calc(100vw-1.5rem))] overflow-y-auto rounded-ui border border-line bg-background p-0 text-foreground shadow-2xl backdrop:bg-black/60"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-surface px-4 py-3 sm:px-6">
          <h2 id="preview-title" className="font-semibold">Product preview</h2>
          <button
            type="button"
            onClick={() => previewRef.current?.close()}
            className="inline-flex size-9 items-center justify-center rounded-ui text-muted hover:bg-surface-muted hover:text-foreground"
            aria-label="Close preview"
          >
            <Icon name="close" className="size-5" />
          </button>
        </div>
        <div className="p-4 sm:p-6">{previewOpen && <ProductPreview draft={draft} options={options} />}</div>
      </dialog>
    </form>
    </>
  );
}

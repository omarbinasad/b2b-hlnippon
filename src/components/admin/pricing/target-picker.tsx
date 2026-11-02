"use client";

import { useState, useTransition } from "react";
import { productOptionAction } from "@/app/admin/pricing/actions";
import { LinkedProductsField, ProductSearch } from "@/components/admin/products/product-search";
import { Badge } from "@/components/ui/badge";
import type { RuleProductOption } from "@/lib/data/repositories";
import { formatMoney } from "@/lib/format";
import type { Category, ProductPick, RuleTarget } from "@/lib/types";

const TYPES: { value: RuleTarget["type"]; label: string; help: string }[] = [
  { value: "all", label: "All products", help: "Every product and variation." },
  { value: "categories", label: "Categories", help: "Products in these categories, including subcategories." },
  { value: "products", label: "Products", help: "All variations of these products." },
  { value: "variations", label: "Variations", help: "Specific options of one variable product." },
];

export interface TargetPickerProps {
  value: RuleTarget;
  onChange: (t: RuleTarget) => void;
  categories: Pick<Category, "id" | "name" | "parentId">[];
  /** Names for the currently selected products. */
  initialPicks: ProductPick[];
  /** Variations of the currently targeted product, when target is "variations". */
  initialProduct: RuleProductOption | null;
  error?: string;
  /** Extra explanation under the type choice (e.g. per-line meaning for quantity rules). */
  note?: string;
}

/** Choose what a rule applies to: all products, categories, products or variations. */
export function TargetPicker({ value, onChange, categories, initialPicks, initialProduct, error, note }: TargetPickerProps) {
  const [picks, setPicks] = useState<ProductPick[]>(initialPicks);
  const [product, setProduct] = useState<RuleProductOption | null>(initialProduct);
  const [pending, startTransition] = useTransition();
  const depth = (c: { parentId?: string }) => (c.parentId ? 1 : 0);

  const setType = (type: RuleTarget["type"]) => {
    if (type === "all") onChange({ type });
    if (type === "categories") onChange({ type, categoryIds: value.type === "categories" ? value.categoryIds : [] });
    if (type === "products") onChange({ type, productIds: picks.map((p) => p.id) });
    if (type === "variations") onChange({ type, productId: product?.productId ?? "", variationIds: [] });
  };

  return (
    <fieldset id="rule-target" tabIndex={-1} className="space-y-3" aria-describedby={error ? "rule-target-error" : undefined}>
      <legend className="text-sm font-semibold">Applies to products</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {TYPES.map((t) => (
          <label key={t.value} className="flex cursor-pointer gap-3 rounded-ui border border-line p-3 has-checked:border-brand has-checked:bg-brand-soft">
            <input type="radio" name="target-type" checked={value.type === t.value} onChange={() => setType(t.value)} className="mt-0.5 accent-brand" />
            <span>
              <span className="block text-sm font-medium">{t.label}</span>
              <span className="block text-xs text-muted">{t.help}</span>
            </span>
          </label>
        ))}
      </div>
      {note && <p className="rounded-ui bg-surface-muted px-3 py-2 text-xs">{note}</p>}

      {value.type === "categories" && (
        <div className="max-h-72 space-y-1.5 overflow-y-auto rounded-ui border border-line p-3">
          {categories.map((c) => (
            <label key={c.id} className="flex items-center gap-2 text-sm" style={{ paddingLeft: `${depth(c) * 1.25}rem` }}>
              <input
                type="checkbox"
                className="size-4 accent-brand"
                checked={value.categoryIds.includes(c.id)}
                onChange={(e) =>
                  onChange({ type: "categories", categoryIds: e.target.checked ? [...value.categoryIds, c.id] : value.categoryIds.filter((id) => id !== c.id) })
                }
              />
              {c.name}
            </label>
          ))}
        </div>
      )}

      {value.type === "products" && (
        <LinkedProductsField
          id="rule-products"
          label="Products"
          description="Search by name or SKU. Results load from the server (max 10)."
          selected={picks}
          onChange={(next) => {
            setPicks(next);
            onChange({ type: "products", productIds: next.map((p) => p.id) });
          }}
        />
      )}

      {value.type === "variations" && (
        <div className="space-y-3">
          {product ? (
            <div className="rounded-ui border border-line p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">{product.name}</p>
                <button
                  type="button"
                  className="text-sm text-brand hover:underline"
                  onClick={() => {
                    setProduct(null);
                    onChange({ type: "variations", productId: "", variationIds: [] });
                  }}
                >
                  Change product
                </button>
              </div>
              {product.variations.length ? (
                <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                  {product.variations.map((v) => (
                    <label key={v.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="size-4 accent-brand"
                        checked={value.variationIds.includes(v.id)}
                        onChange={(e) =>
                          onChange({ type: "variations", productId: product.productId, variationIds: e.target.checked ? [...value.variationIds, v.id] : value.variationIds.filter((id) => id !== v.id) })
                        }
                      />
                      <span>
                        {v.label} <span className="text-xs text-muted">{v.sku}{v.basePrice !== undefined && ` · ${formatMoney(v.basePrice)}`}</span>
                      </span>
                      {v.status !== "active" && <Badge tone="neutral">Disabled</Badge>}
                    </label>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted">This product has no variations — target it under “Products” instead.</p>
              )}
            </div>
          ) : (
            <ProductSearch
              id="rule-variation-product"
              label="Variable product"
              excludeIds={[]}
              pickLabel="Choose"
              onPick={(p) =>
                startTransition(async () => {
                  const option = await productOptionAction(p.id);
                  setProduct(option);
                  if (option) onChange({ type: "variations", productId: option.productId, variationIds: [] });
                })
              }
            />
          )}
          {pending && <p role="status" className="text-xs text-muted">Loading variations…</p>}
        </div>
      )}
      {error && <p id="rule-target-error" className="text-xs text-danger">{error}</p>}
    </fieldset>
  );
}

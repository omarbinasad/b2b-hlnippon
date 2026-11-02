"use client";

import { Badge, StockBadge } from "@/components/ui/badge";
import { Notice } from "@/components/ui/feedback";
import { Icon } from "@/components/ui/icons";
import { siteConfig } from "@/config/site";
import { originCountryName } from "@/lib/countries";
import { formatCalendarDate, formatMoney, humanize } from "@/lib/format";
import type { StockStatus } from "@/lib/types";
import { draftToInput, type FormOptions, type ProductDraft } from "./draft";

const valid = (n?: number): n is number => n !== undefined && Number.isFinite(n);

function PriceTag({ price, sale, from, to }: { price?: number; sale?: number; from?: string; to?: string }) {
  if (!valid(price)) return <span className="text-muted">No price yet</span>;
  if (!(valid(sale) && sale < price)) return <span className="text-2xl font-semibold tabular-nums">{formatMoney(price)}</span>;
  return (
    <span className="inline-flex flex-wrap items-baseline gap-2">
      <span className="text-2xl font-semibold text-danger tabular-nums">{formatMoney(sale)}</span>
      <s className="text-muted tabular-nums">{formatMoney(price)}</s>
      <Badge tone="danger">Sale</Badge>
      {(from || to) && (
        <span className="text-xs text-muted">
          {from ? `from ${formatCalendarDate(from)}` : ""} {to ? `until ${formatCalendarDate(to)}` : ""}
        </span>
      )}
    </span>
  );
}

/** Rough stock preview; the backend decides the real status (e.g. low-stock threshold). */
const previewStock = (tracked: boolean, qty: number | undefined, status: StockStatus): StockStatus =>
  tracked ? (valid(qty) && qty > 0 ? "in_stock" : "out_of_stock") : status;

/** Storefront-style preview of the product as an approved customer would see it. */
export function ProductPreview({ draft, options }: { draft: ProductDraft; options: FormOptions }) {
  const input = draftToInput(draft);
  const main = draft.images[0];
  const active = input.variations.filter((v) => v.status === "active");
  const prices = active.map((v) => v.salePrice ?? v.basePrice).filter(valid);
  const origin = originCountryName(input.originCountry);
  const imported = input.originCountry && input.originCountry !== siteConfig.country;
  const brand = options.brands.filter((b) => input.brandIds.includes(b.id)).map((b) => b.name).join(", ");
  const categories = options.categories.filter((c) => input.categoryIds.includes(c.id)).map((c) => c.name);
  const infoAttributes = input.attributes.filter((a) => a.visible);
  const variationAttributes = input.attributes.filter((a) => a.variation);
  const parentStock = previewStock(input.manageStock, input.stockQuantity, input.stockStatus);

  return (
    <div className="space-y-5">
      <Notice>
        Preview of the product page as an <strong>approved customer</strong> would see it. Guests see “Log in for wholesale
        price” instead of prices. {input.status !== "published" && <strong>This product is not published yet.</strong>}
      </Notice>

      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <div className="aspect-square overflow-hidden rounded-ui bg-surface-muted">
            {main ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={main.src} alt={main.alt} className="size-full object-cover" />
            ) : (
              <div className="grid size-full place-items-center text-muted" role="img" aria-label="No image">
                <Icon name="image" className="size-10 opacity-40" />
              </div>
            )}
          </div>
          {draft.images.length > 1 && (
            <ul className="mt-2 grid grid-cols-5 gap-2" aria-label="Gallery">
              {draft.images.slice(1, 6).map((img) => (
                <li key={img.key} className="aspect-square overflow-hidden rounded-ui bg-surface-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.src} alt={img.alt} className="size-full object-cover" />
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <div className="mb-2 flex flex-wrap gap-1.5">
              <Badge tone={input.status === "published" ? "success" : "warning"}>{humanize(input.status)}</Badge>
              {input.featured && <Badge tone="brand">Featured</Badge>}
              {imported && <Badge tone="info">Imported from {origin}</Badge>}
            </div>
            {brand && <p className="text-sm font-medium text-muted">{brand}</p>}
            <h3 className="text-2xl font-semibold tracking-tight">{input.name || "Untitled product"}</h3>
            <p className="mt-1 text-sm text-muted">SKU {input.sku || "—"}{input.gtin ? ` · GTIN ${input.gtin}` : ""}</p>
          </div>

          {input.shortDescription && <p className="text-muted">{input.shortDescription}</p>}

          <div>
            {input.type === "simple" ? (
              <PriceTag price={input.basePrice} sale={input.salePrice} from={input.saleFrom} to={input.saleTo} />
            ) : prices.length ? (
              <span className="text-2xl font-semibold tabular-nums">
                {formatMoney(Math.min(...prices))}
                {Math.max(...prices) !== Math.min(...prices) && ` – ${formatMoney(Math.max(...prices))}`}
              </span>
            ) : (
              <span className="text-muted">No prices yet</span>
            )}
            <p className="text-xs text-muted">per {input.unitLabel || "unit"}, excl. tax · customer-specific prices may apply</p>
          </div>

          {input.type === "variable" && active.length > 0 && (
            <div>
              <p className="mb-1.5 text-sm font-medium">{variationAttributes.map((a) => a.name).join(" / ") || "Options"}</p>
              <ul className="flex flex-wrap gap-2">
                {active.map((v, i) => {
                  const isDefault = variationAttributes.length > 0 && variationAttributes.every((a) => input.defaultAttributes[a.name] === v.attributes[a.name]);
                  const stock = v.stockMode === "parent" ? parentStock : previewStock(v.stockMode === "track", v.stockQuantity, v.stockStatus);
                  return (
                    <li key={v.id ?? i} className={`rounded-ui border px-3 py-1.5 text-sm ${isDefault ? "border-brand bg-brand-soft" : "border-line"}`}>
                      <span className="font-medium">{Object.values(v.attributes).join(" · ") || "Option"}</span>{" "}
                      <span className="text-muted tabular-nums">
                        {valid(v.salePrice) ? formatMoney(v.salePrice) : valid(v.basePrice) ? formatMoney(v.basePrice) : "No price"}
                      </span>{" "}
                      <StockBadge status={stock} />
                      {isDefault && <span className="sr-only"> (selected by default)</span>}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {input.type === "simple" && <StockBadge status={parentStock} />}
          {input.soldIndividually && <p className="text-sm text-muted">Limit: one per order.</p>}

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-ui border border-line p-4 text-sm">
            <dt className="text-muted">Unit</dt>
            <dd>{valid(input.weight.value) ? `${input.weight.value} ${input.weight.unit}` : "—"} / {input.unitLabel || "unit"}</dd>
            <dt className="text-muted">Origin</dt>
            <dd>{origin ?? "Not specified"}</dd>
            <dt className="text-muted">Categories</dt>
            <dd>{categories.length ? categories.join(", ") : "—"}</dd>
            {input.tags.length > 0 && (
              <>
                <dt className="text-muted">Tags</dt>
                <dd>{input.tags.join(", ")}</dd>
              </>
            )}
            {input.dimensions && [input.dimensions.length, input.dimensions.width, input.dimensions.height].every(valid) && (
              <>
                <dt className="text-muted">Dimensions</dt>
                <dd>{input.dimensions.length} × {input.dimensions.width} × {input.dimensions.height} {input.dimensions.unit}</dd>
              </>
            )}
          </dl>
          {input.isVariableWeight && <p className="text-sm text-muted">Priced by weight — the final amount is adjusted to the packed weight.</p>}
        </div>
      </div>

      {input.description && (
        <div>
          <h4 className="mb-1 font-semibold">Description</h4>
          <p className="text-sm whitespace-pre-line text-muted">{input.description}</p>
        </div>
      )}

      {infoAttributes.length > 0 && (
        <div>
          <h4 className="mb-1 font-semibold">Additional information</h4>
          <dl className="grid grid-cols-[10rem_1fr] gap-x-4 gap-y-1 text-sm">
            {infoAttributes.map((a) => (
              <div key={a.name} className="contents">
                <dt className="text-muted">{a.name}</dt>
                <dd>{a.values.join(", ") || "—"}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {(draft.upsells.length > 0 || draft.crossSells.length > 0) && (
        <div className="grid gap-3 text-sm sm:grid-cols-2">
          {draft.upsells.length > 0 && <p><span className="font-semibold">You may also like:</span> {draft.upsells.map((p) => p.name).join(", ")}</p>}
          {draft.crossSells.length > 0 && <p><span className="font-semibold">In the cart, suggest:</span> {draft.crossSells.map((p) => p.name).join(", ")}</p>}
        </div>
      )}
    </div>
  );
}

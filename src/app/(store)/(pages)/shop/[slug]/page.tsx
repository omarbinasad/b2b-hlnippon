import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToCart } from "@/components/product/add-to-cart";
import { ProductGallery } from "@/components/product/product-gallery";
import { StockBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { countryName, formatMoney, formatWeight } from "@/lib/format";
import { Notice } from "@/components/ui/feedback";
import { RichText } from "@/components/ui/rich-text";
import { getShoppingCustomerId, getViewer } from "@/lib/auth/session";
import { STANDARD_PRICING_ID } from "@/lib/pricing/standard";
import { repositories } from "@/lib/data";

export async function generateMetadata({ params }: PageProps<"/shop/[slug]">): Promise<Metadata> {
  const product = await repositories.products.getBySlug((await params).slug);
  return product ? { title: product.name, description: product.shortDescription } : {};
}

export default async function ProductPage({ params }: PageProps<"/shop/[slug]">) {
  const product = await repositories.products.getBySlug((await params).slug);
  if (!product) notFound();

  const { quantityRule: rule } = product;
  // Per-line limits come from quantity rules (shown for the product itself; variations can differ).
  const limits = await repositories.quantityRules.effectiveFor(product.id);
  // Approved customers get their own prices and the cart; everyone else sees product data only.
  const customerId = await getShoppingCustomerId();
  const viewer = customerId ? null : await getViewer();
  // Staff see the standard wholesale price for each option, without a cart.
  const staffPrices = viewer?.kind === "admin" ? await repositories.orders.orderableProduct(product.id, STANDARD_PRICING_ID) : null;
  const orderable = customerId ? await repositories.orders.orderableProduct(product.id, customerId) : null;

  return (
    <>
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted">
        <Link href="/shop" className="hover:text-foreground">Shop</Link> <span aria-hidden>/</span>{" "}
        <span aria-current="page">{product.name}</span>
      </nav>

      <div className="grid gap-6 md:grid-cols-2 md:gap-10">
        <ProductGallery images={product.images} />

        <div className="space-y-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{product.name}</h1>
            <p className="mt-1 text-sm text-muted">SKU {product.sku}</p>
          </div>
          <StockBadge status={product.stock.status} />
          <RichText value={product.description} className="text-muted" />

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-ui border border-line bg-surface p-4 text-sm">
            <dt className="text-muted">Unit</dt>
            <dd>{formatWeight(product.weight)} / {product.unitLabel}</dd>
            {product.originCountry && (
              <>
                <dt className="text-muted">Origin</dt>
                <dd>{countryName(product.originCountry)}</dd>
              </>
            )}
            <dt className="text-muted">Minimum order</dt>
            <dd>{limits?.min ?? 1} {product.unitLabel}</dd>
            <dt className="text-muted">Order in multiples of</dt>
            <dd>{rule.step}</dd>
            {limits?.max !== undefined && (
              <>
                <dt className="text-muted">Maximum per order</dt>
                <dd>{limits.max}</dd>
              </>
            )}
            {product.variations.some((v) => v.status === "active") && (
              <>
                <dt className="text-muted">Options</dt>
                <dd>{product.variations.filter((v) => v.status === "active").map((v) => Object.values(v.attributes).join(" ")).join(", ")}</dd>
              </>
            )}
          </dl>

          {product.isVariableWeight && (
            <Notice title="Priced by weight">
              The final price is adjusted to the actual packed weight after your order is prepared.
            </Notice>
          )}

          {orderable ? (
            <AddToCart
              productId={product.id}
              unitLabel={product.unitLabel}
              step={rule.step}
              options={orderable.options.map((o) => ({
                variationId: o.variationId,
                label: o.label,
                price: o.customerPrice,
                available: o.available && product.status === "published",
                stockStatus: o.stock.status,
                min: o.minQuantity,
                max: o.maxQuantity,
              }))}
            />
          ) : customerId ? (
            <Notice tone="warning">This product has no price yet and can&apos;t be ordered online. Contact us to order it.</Notice>
          ) : viewer?.kind === "customer" ? (
            <Notice>Your business account is awaiting approval. Wholesale prices and ordering appear once it is approved.</Notice>
          ) : viewer?.kind === "admin" && staffPrices ? (
            <section aria-label="Prices" className="space-y-3 rounded-ui border border-line bg-surface p-4">
              <ul className="divide-y divide-line">
                {staffPrices.options.map((o) => (
                  <li key={o.variationId ?? "single"} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm first:pt-0 last:pb-0">
                    <span className="min-w-0">
                      <span className="block font-medium">{o.label}</span>
                      <span className="block text-xs text-muted">Min {o.minQuantity}{o.maxQuantity !== undefined ? ` · max ${o.maxQuantity}` : ""} · <StockBadge status={o.stock.status} /></span>
                    </span>
                    <span className="text-right">
                      {o.customerPrice !== undefined ? <span className="font-semibold tabular-nums">{formatMoney(o.customerPrice)}</span> : <span className="text-xs text-muted">No price yet</span>}
                      <span className="block text-xs text-muted">excl. tax</span>
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted">Staff view: standard wholesale prices, before any customer&apos;s own prices. Staff don&apos;t have a cart.</p>
              <ButtonLink href="/admin/orders/new" size="sm">Create an order for a customer</ButtonLink>
            </section>
          ) : viewer?.kind === "admin" ? (
            <Notice tone="warning">This product has no price yet.</Notice>
          ) : (
            <Notice>
              Wholesale prices and ordering are available to approved business customers.{" "}
              <Link href="/login" className="font-medium underline">Log in</Link> or{" "}
              <Link href="/register" className="font-medium underline">apply for an account</Link>.
            </Notice>
          )}
        </div>
      </div>

      <div className="mt-10">
      </div>
    </>
  );
}

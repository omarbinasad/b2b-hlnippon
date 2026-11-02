import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToCart } from "@/components/product/add-to-cart";
import { ProductImage } from "@/components/product/product-image";
import { StockBadge } from "@/components/ui/badge";
import { Notice, PlannedFeatures } from "@/components/ui/feedback";
import { RichText } from "@/components/ui/rich-text";
import { getShoppingCustomerId, getViewer } from "@/lib/auth/session";
import { repositories } from "@/lib/data";
import { countryName, formatWeight } from "@/lib/format";

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
  const orderable = customerId ? await repositories.orders.orderableProduct(product.id, customerId) : null;
  const viewer = customerId ? null : await getViewer();

  return (
    <>
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted">
        <Link href="/shop" className="hover:text-foreground">Shop</Link> <span aria-hidden>/</span>{" "}
        <span aria-current="page">{product.name}</span>
      </nav>

      <div className="grid gap-6 md:grid-cols-2 md:gap-10">
        <ProductImage image={product.images[0]} sizes="(min-width: 768px) 50vw, 100vw" priority />

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
          ) : viewer?.kind === "admin" ? (
            <Notice>Admin preview: prices and the cart are shown only to approved customers (switch “Demo view” to Approved customer to preview).</Notice>
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
        <PlannedFeatures items={["Image gallery"]} />
      </div>
    </>
  );
}

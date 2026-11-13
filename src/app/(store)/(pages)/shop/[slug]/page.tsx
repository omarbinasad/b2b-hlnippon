import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToCart } from "@/components/product/add-to-cart";
import { ProductGallery } from "@/components/product/product-gallery";
import { StockBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icons";
import { countryName, formatMoney, formatWeight } from "@/lib/format";
import { Notice } from "@/components/ui/feedback";
import { RichText } from "@/components/ui/rich-text";
import { Tabs } from "@/components/ui/tabs";
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
  // Per-line limits: the product's own minimum, maximum and multiple, overridden by quantity rules (variations can differ).
  const limits = await repositories.quantityRules.effectiveFor(product.id);
  // Approved customers get their own prices and the cart; everyone else sees product data only.
  const customerId = await getShoppingCustomerId();
  const viewer = customerId ? null : await getViewer();
  // Staff see the standard wholesale price for each option, without a cart.
  const staffPrices = viewer?.kind === "admin" ? await repositories.orders.orderableProduct(product.id, STANDARD_PRICING_ID) : null;
  const orderable = customerId ? await repositories.orders.orderableProduct(product.id, customerId) : null;
  const brands = product.brandIds.length ? (await repositories.catalogSettings.brands()).filter((b) => product.brandIds.includes(b.id)) : [];
  const badges = ((await repositories.siteContent.get()).productBadges ?? []).filter((b) => b.label.trim()).slice(0, 6);
  const activeOptions = product.variations.filter((v) => v.status === "active");
  const min = limits?.min ?? 1;
  const step = limits?.step ?? rule.step;
  // Only what a buyer needs at a glance; the full text is in the Description tab. Order limits show here only when they
  // matter; the quantity field shows every limit to approved customers.
  const facts: [string, string][] = [
    ["Weight", `${formatWeight(product.weight)} per ${product.unitLabel}`],
    ...(product.originCountry ? [["Origin", countryName(product.originCountry)] as [string, string]] : []),
    ...(brands.length ? [[brands.length > 1 ? "Brands" : "Brand", brands.map((b) => b.name).join(", ")] as [string, string]] : []),
    ...(activeOptions.length ? [["Options", activeOptions.map((v) => Object.values(v.attributes).join(" ")).join(", ")] as [string, string]] : []),
    ...(min > 1 ? [["Minimum order", `${min} ${product.unitLabel}`] as [string, string]] : []),
    ...(step > 1 ? [["Order in multiples of", String(step)] as [string, string]] : []),
    // A maximum set on this product (or sold one at a time) matters; a store-wide cap is left to the quantity field.
    ...((rule.max !== undefined || product.soldIndividually) && limits?.max !== undefined ? [["Maximum per order", String(limits.max)] as [string, string]] : []),
  ];

  return (
    <>
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted">
        <Link href="/shop" className="hover:text-foreground">Shop</Link> <span aria-hidden>/</span>{" "}
        <span aria-current="page">{product.name}</span>
      </nav>

      <div className="grid gap-6 md:grid-cols-2 md:gap-10">
        <ProductGallery images={product.images} />

        <div className="space-y-5">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{product.name}</h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
              <StockBadge status={product.stock.status} />
              {product.sku && <span>SKU {product.sku}</span>}
            </div>
          </div>

          <dl aria-label="Product details" className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-2 border-y border-line py-4 text-sm">
            {facts.map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-muted">{label}</dt>
                <dd className="font-medium">{value}</dd>
              </div>
            ))}
          </dl>

          {product.isVariableWeight && (
            <p className="text-sm text-muted">
              <span className="font-medium text-foreground">Priced by weight.</span> The final price is adjusted to the actual packed weight after your order is prepared.
            </p>
          )}

          {orderable ? (
            <AddToCart
              productId={product.id}
              unitLabel={product.unitLabel}
              step={step}
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

          {/* Store promises from Homepage → Product page badges (the same for every product). */}
          {badges.length > 0 && (
            <ul aria-label="Why buy from us" className="grid grid-cols-2 gap-y-4 rounded-ui border border-line px-2 py-4 sm:grid-cols-4 md:grid-cols-2 lg:grid-cols-4">
              {badges.map((b, i) => (
                <li key={`${i}-${b.label}`} className="flex flex-col items-center gap-1.5 px-1 text-center text-xs font-medium sm:text-sm">
                  <Icon name={b.icon as IconName} className="size-6 text-muted" />
                  {b.label}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <section aria-label="More about this product" className="mt-10 sm:mt-14">
        <Tabs
          label="Product information"
          tabs={[
            {
              id: "description",
              label: "Description",
              content: product.description ? <RichText value={product.description} className="max-w-3xl pt-5 text-muted" /> : <p className="pt-5 text-sm text-muted">No description yet.</p>,
            },
            ...(product.reviewsEnabled
              ? [{ id: "reviews", label: "Reviews (0)", content: <p className="pt-5 text-sm text-muted">There are no reviews for this product yet.</p> }]
              : []),
          ]}
        />
      </section>
    </>
  );
}

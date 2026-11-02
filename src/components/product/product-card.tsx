import type { Route } from "next";
import Link from "next/link";
import { StockBadge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icons";
import { cx } from "@/lib/cx";
import { formatWeight, formatMoney } from "@/lib/format";
import type { PriceAccess } from "@/components/shop/filter-sidebar";
import type { ProductSummary, Money } from "@/lib/types";
import { ProductImage } from "./product-image";
import { QuickAddButton } from "./quick-add-button";

/** What the round + on the card does for this viewer and product (decided on the server). */
export type CardAction =
  | { kind: "add"; quantity: number }
  | { kind: "link"; href: string; label: string }
  | { kind: "disabled"; label: string };

const addCircle = "grid size-10 shrink-0 place-items-center rounded-full bg-brand text-brand-contrast transition-colors hover:bg-brand-hover";

interface ProductCardProps {
  product: ProductSummary;
  /** Wholesale unit price for the current viewer; omit to hide pricing (guests). */
  price?: Money;
  /** Who is looking — decides the message shown instead of a price. */
  access?: PriceAccess;
  action?: CardAction;
}

const noPriceText: Record<PriceAccess, string> = {
  guest: "Log in for wholesale price",
  pending: "Price shown once your account is approved",
  admin: "Price shown to approved customers",
  approved: "See options for prices",
};

export function ProductCard({ product, price, access = "guest", action }: ProductCardProps) {
  return (
    <article className="group relative flex h-full flex-col rounded-ui border border-line bg-surface p-3">
      <ProductImage image={product.image} />
      <div className="mt-3 flex flex-1 flex-col gap-1">
        <h3 className="text-sm leading-snug font-semibold">
          <Link href={`/shop/${product.slug}`} className="after:absolute after:inset-0 after:rounded-ui group-hover:underline">
            {product.name}
          </Link>
        </h3>
        <p className="text-xs text-muted">
          {formatWeight(product.weight)} / {product.unitLabel}
          {product.isVariableWeight && " · priced by weight"}
        </p>
        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          {price !== undefined ? (
            <p className="text-sm font-semibold tabular-nums">
              {formatMoney(price)} <span className="text-xs font-normal text-muted">excl. tax</span>
            </p>
          ) : (
            <p className="text-xs text-muted">{access === "approved" && !product.hasVariations ? "No price yet" : noPriceText[access]}</p>
          )}
          {/* z-10: above the link that makes the whole card clickable. */}
          <div className="relative z-10 flex shrink-0 flex-col items-end gap-2">
            <StockBadge status={product.stock.status} />
            {action?.kind === "add" && <QuickAddButton productId={product.id} name={product.name} quantity={action.quantity} className={addCircle} />}
            {action?.kind === "link" && (
              <Link href={action.href as Route} title={action.label} aria-label={`${action.label}: ${product.name}`} className={addCircle}>
                <Icon name="plus" className="size-5" />
              </Link>
            )}
            {action?.kind === "disabled" && (
              <button type="button" disabled title={action.label} aria-label={`${product.name}: ${action.label}`} className={cx(addCircle, "cursor-not-allowed opacity-40 hover:bg-brand")}>
                <Icon name="plus" className="size-5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

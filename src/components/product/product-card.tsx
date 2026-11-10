import type { Route } from "next";
import Link from "next/link";
import { StockBadge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icons";
import { cx } from "@/lib/cx";
import { formatWeight, formatMoney } from "@/lib/format";
import type { PriceAccess } from "@/components/shop/filter-sidebar";
import type { ProductSummary, Money } from "@/lib/types";
import { ProductImage } from "./product-image";
import { CardQuantity } from "./card-quantity";

/** What the round + on the card does for this viewer and product (decided on the server). "add" also shows a quantity control. */
export type CardAction =
  | { kind: "add"; quantity: number; max?: number; step?: number }
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
  layout?: "grid" | "list";
}

const noPriceText: Record<PriceAccess, string> = {
  guest: "Log in for wholesale price",
  pending: "Price shown once your account is approved",
  admin: "Price shown to approved customers",
  approved: "See options for prices",
};

export function ProductCard({ product, price, access = "guest", action, layout = "grid" }: ProductCardProps) {
  return (
    <article className={cx("group relative flex h-full rounded-ui border border-line bg-surface p-3", layout === "list" ? "flex-row gap-3 sm:gap-4" : "flex-col")}>
      <div className={cx("relative", layout === "list" && "w-28 shrink-0 sm:w-40")}>
        <ProductImage image={product.image} />
        <div className="absolute top-2 left-2">
          <StockBadge status={product.stock.status} />
        </div>
      </div>
      <div className={cx("flex min-w-0 flex-1 flex-col gap-1", layout === "grid" && "mt-3")}>
        <h3 className="text-sm leading-snug font-semibold">
          <Link href={`/shop/${product.slug}`} className="after:absolute after:inset-0 after:rounded-ui group-hover:underline">
            {product.name}
          </Link>
        </h3>
        <p className="text-xs text-muted">
          {formatWeight(product.weight)} / {product.unitLabel}
          {product.isVariableWeight && " · priced by weight"}
        </p>
        {layout === "list" && product.shortDescription && <p className="line-clamp-2 text-xs text-muted">{product.shortDescription}</p>}
        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          {price !== undefined ? (
            <p className="text-sm font-semibold tabular-nums">
              {formatMoney(price)} <span className="text-xs font-normal text-muted">excl. tax</span>
            </p>
          ) : (
            <p className="text-xs text-muted">{(access === "approved" || access === "admin") && !product.hasVariations ? "No price yet" : noPriceText[access]}</p>
          )}
          {/* z-10: above the link that makes the whole card clickable. */}
          <div className="relative z-10 shrink-0">
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
        {action?.kind === "add" && (
          <div className="relative z-10 mt-2">
            <CardQuantity productId={product.id} name={product.name} min={action.quantity} max={action.max} step={action.step ?? 1} addClassName="grid size-9 shrink-0 place-items-center rounded-full bg-brand text-brand-contrast transition-colors hover:bg-brand-hover sm:size-10" />
          </div>
        )}
      </div>
    </article>
  );
}

import Link from "next/link";
import { duplicateProductAction, setProductStatusAction } from "@/app/admin/products/actions";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Icon } from "@/components/ui/icons";
import type { AdminProductRow } from "@/lib/types";

const iconButton =
  "inline-flex size-9 items-center justify-center rounded-ui text-muted hover:bg-surface-muted hover:text-foreground";

/** Edit / Duplicate / Archive-or-Restore for one product row. `returnTo` = current list URL. */
export function ProductRowActions({ product, returnTo }: { product: AdminProductRow; returnTo: string }) {
  const hidden = (
    <>
      <input type="hidden" name="id" value={product.id} />
      <input type="hidden" name="returnTo" value={returnTo} />
    </>
  );
  return (
    <div className="flex items-center justify-end gap-0.5">
      <Link href={`/admin/products/${product.id}/edit`} className={iconButton} aria-label={`Edit ${product.name}`} title="Edit">
        <Icon name="pencil" className="size-4" />
      </Link>
      <form action={duplicateProductAction}>
        {hidden}
        <button type="submit" className={iconButton} aria-label={`Duplicate ${product.name}`} title="Duplicate">
          <Icon name="copy" className="size-4" />
        </button>
      </form>
      <form action={setProductStatusAction}>
        {hidden}
        {product.status === "archived" ? (
          <>
            <input type="hidden" name="status" value="draft" />
            <button type="submit" className={iconButton} aria-label={`Restore ${product.name}`} title="Restore as draft">
              <Icon name="restore" className="size-4" />
            </button>
          </>
        ) : (
          <>
            <input type="hidden" name="status" value="archived" />
            <ConfirmButton
              className={iconButton}
              label={`Archive ${product.name}`}
              title="Archive this product?"
              message={
                <>
                  <strong className="text-foreground">{product.name}</strong> will be hidden from the store and the default
                  product list. Order history is kept, and you can restore it later.
                </>
              }
              confirmLabel="Archive"
            >
              <Icon name="archive" className="size-4" />
            </ConfirmButton>
          </>
        )}
      </form>
    </div>
  );
}

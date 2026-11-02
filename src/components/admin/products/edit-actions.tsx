import Link from "next/link";
import { duplicateProductAction, setProductStatusAction } from "@/app/admin/products/actions";
import { buttonClasses } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Icon } from "@/components/ui/icons";
import type { Product } from "@/lib/types";

/** Page-level actions for the edit screen (outside the product form, so each has its own form). */
export function ProductEditActions({ product }: { product?: Product }) {
  const returnTo = product ? `/admin/products/${product.id}/edit` : "/admin/products";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link href="/admin/products/new" className={buttonClasses({ variant: "secondary", size: "sm" })}>
        <Icon name="plus" className="size-4" /> Add new product
      </Link>
      {product && (
        <>
          <form action={duplicateProductAction}>
            <input type="hidden" name="id" value={product.id} />
            <input type="hidden" name="returnTo" value={returnTo} />
            <button type="submit" className={buttonClasses({ variant: "secondary", size: "sm" })} title="Duplicates the last saved version">
              <Icon name="copy" className="size-4" /> Copy to a new draft
            </button>
          </form>
          <form action={setProductStatusAction}>
            <input type="hidden" name="id" value={product.id} />
            <input type="hidden" name="returnTo" value={returnTo} />
            {product.status === "archived" ? (
              <>
                <input type="hidden" name="status" value="draft" />
                <button type="submit" className={buttonClasses({ variant: "secondary", size: "sm" })}>
                  <Icon name="restore" className="size-4" /> Restore as draft
                </button>
              </>
            ) : (
              <>
                <input type="hidden" name="status" value="archived" />
                <ConfirmButton
                  className={buttonClasses({ variant: "ghost", size: "sm" }) + " text-danger"}
                  title="Archive this product?"
                  message={
                    <>
                      <strong className="text-foreground">{product.name}</strong> will be hidden from the store and the default
                      product list. Order history is kept and you can restore it later. Unsaved changes in the form are not saved.
                    </>
                  }
                  confirmLabel="Archive"
                >
                  <Icon name="archive" className="size-4" /> Archive
                </ConfirmButton>
              </>
            )}
          </form>
        </>
      )}
    </div>
  );
}

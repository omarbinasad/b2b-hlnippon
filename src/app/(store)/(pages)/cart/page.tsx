import type { Metadata } from "next";
import { CartView } from "@/components/cart/cart-view";
import { ShopperGate } from "@/components/cart/shopper-gate";
import { Notice } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { getShoppingCustomerId, getViewer } from "@/lib/auth/session";
import { repositories } from "@/lib/data";

export const metadata: Metadata = { title: "Cart", robots: { index: false } };

export default async function CartPage({ searchParams }: PageProps<"/cart">) {
  const customerId = await getShoppingCustomerId();
  const sp = await searchParams;
  const reordered = Number(sp.reordered);
  const skipped = Number(sp.skipped);

  return (
    <>
      <PageHeader title="Cart" description="Review items before checkout. Prices are your wholesale prices." />
      {customerId ? (
        <div className="space-y-4">
          <Notice tone="warning">Demo: the cart is kept on this demo server only and is lost when it restarts.</Notice>
          {reordered > 0 && (
            <Notice tone="success">
              {reordered} product{reordered === 1 ? "" : "s"} from your order added at today&apos;s prices.
              {skipped > 0 && ` ${skipped} could not be added (no longer available).`}
            </Notice>
          )}
          <CartView initial={await repositories.cart.get(customerId)} />
        </div>
      ) : (
        <ShopperGate viewer={await getViewer()} />
      )}
    </>
  );
}

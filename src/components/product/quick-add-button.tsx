"use client";

import { useEffect, useState, useTransition } from "react";
import { addToCartAction } from "@/app/(store)/actions";
import { Icon } from "@/components/ui/icons";
import { cx } from "@/lib/cx";

/** Round + on a product card: adds the product's minimum quantity to the cart. The server re-prices and re-checks it. */
export function QuickAddButton({ productId, name, quantity, className }: { productId: string; name: string; quantity: number; className?: string }) {
  const [pending, startTransition] = useTransition();
  const [added, setAdded] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!added) return;
    const timer = setTimeout(() => setAdded(false), 1500);
    return () => clearTimeout(timer);
  }, [added]);

  return (
    <>
      <button
        type="button"
        disabled={pending}
        title={quantity > 1 ? `Add ${quantity} to cart` : "Add to cart"}
        aria-label={`Add ${quantity} × ${name} to cart`}
        onClick={() =>
          startTransition(async () => {
            const r = await addToCartAction([{ productId, quantity }]);
            setError(r.ok ? "" : r.message);
            setAdded(r.ok);
          })
        }
        className={cx(className, pending && "opacity-60")}
      >
        <Icon name={added ? "check" : "plus"} className="size-5" />
      </button>
      <span role="status" className={error ? "max-w-36 text-right text-xs text-danger" : "sr-only"}>
        {error || (added ? `${name} added to your cart` : "")}
      </span>
    </>
  );
}

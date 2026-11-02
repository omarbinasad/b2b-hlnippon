"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import { removeCartLineAction, updateCartLineAction } from "@/app/(store)/actions";
import { StockBadge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Icon } from "@/components/ui/icons";
import { formatMoney } from "@/lib/format";
import type { Cart, CartLine } from "@/lib/types";
import { CartQuantityStepper } from "./quantity-stepper";

/** Cart lines with quantity editing. Every change goes to the server, which re-prices the whole cart. */
export function CartView({ initial }: { initial: Cart }) {
  const [cart, setCart] = useState(initial);
  // The page re-renders with fresh data after a change in the cart panel: show it here too.
  const [loaded, setLoaded] = useState(initial);
  if (initial !== loaded) {
    setLoaded(initial);
    setCart(initial);
  }
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  const run = (action: () => ReturnType<typeof updateCartLineAction>) =>
    startTransition(async () => {
      const r = await action();
      if (r.ok) {
        setCart(r.cart);
        setMessage("");
      } else setMessage(r.message);
    });

  if (!cart.lines.length) {
    return <EmptyState title="Your cart is empty" description="Add products from the shop or reorder from your order history." action={<ButtonLink href="/shop" variant="secondary">Browse products</ButtonLink>} />;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
      <div className={pending ? "opacity-60 transition-opacity" : undefined}>
        <ul className="divide-y divide-line rounded-ui border border-line bg-surface">
          {cart.lines.map((line) => (
            <CartRow key={line.id} line={line} disabled={pending} onQuantity={(q) => run(() => updateCartLineAction(line.id, q))} onRemove={() => run(() => removeCartLineAction(line.id))} />
          ))}
        </ul>
        <p role="alert" className="mt-2 text-sm text-danger">{message}</p>
      </div>

      <aside className="space-y-3 rounded-ui border border-line bg-surface p-4">
        <h2 className="font-semibold">Summary</h2>
        <dl className="flex justify-between text-sm">
          <dt>Items ({cart.lines.length})</dt>
          <dd className="font-semibold tabular-nums">{formatMoney(cart.itemsSubtotal)}</dd>
        </dl>
        <p className="text-xs text-muted">Delivery charge and tax are calculated at checkout for your delivery address.</p>
        {cart.lines.some((l) => l.pricedByWeight) && (
          <p className="text-xs text-muted">Items priced by weight are charged by the actual packed weight; the final amount can differ slightly.</p>
        )}
        {cart.valid ? (
          <ButtonLink href="/checkout" className="w-full">Go to checkout</ButtonLink>
        ) : (
          <>
            <Button disabled className="w-full">Go to checkout</Button>
            <p className="text-xs text-danger">Fix the highlighted items before checkout.</p>
          </>
        )}
      </aside>
    </div>
  );
}

function CartRow({ line, disabled, onQuantity, onRemove }: { line: CartLine; disabled: boolean; onQuantity: (q: number) => void; onRemove: () => void }) {
  return (
    <li className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-3 p-4 sm:grid-cols-[3.5rem_minmax(0,1fr)_auto]">
      <div className="relative size-14 overflow-hidden rounded-ui bg-surface-muted">
        {line.image ? <Image src={line.image.src} alt="" fill sizes="56px" className="object-cover" /> : <Icon name="box" className="absolute inset-0 m-auto size-5 text-muted" />}
      </div>
      <div className="min-w-0 space-y-1">
        {line.slug ? <Link href={`/shop/${line.slug}`} className="block font-medium hover:text-brand hover:underline">{line.name}</Link> : <p className="font-medium">{line.name}</p>}
        <p className="text-xs text-muted">{[line.variationLabel, line.sku].filter(Boolean).join(" · ")}</p>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <StockBadge status={line.stockStatus} />
          {line.unitPrice !== undefined && (
            <span className="tabular-nums">{formatMoney(line.unitPrice)} / {line.unitLabel}{line.priceNote ? <span className="text-xs text-muted"> · {line.priceNote}</span> : null}</span>
          )}
        </div>
        <p className="text-xs text-muted">
          {[`min ${line.minQuantity}`, line.maxQuantity !== undefined && `max ${line.maxQuantity}`, line.step > 1 && `multiples of ${line.step}`].filter(Boolean).join(" · ")}
        </p>
        {line.error && <p className="text-sm text-danger">{line.error}</p>}
      </div>
      <div className="col-span-2 flex items-center justify-between gap-3 sm:col-span-1 sm:flex-col sm:items-end">
        <div className="flex items-center gap-2">
          <CartQuantityStepper name={line.name} quantity={line.quantity} min={line.minQuantity} max={line.maxQuantity} step={line.step} disabled={disabled} invalid={Boolean(line.error)} onChange={onQuantity} />
          <button type="button" onClick={onRemove} disabled={disabled} aria-label={`Remove ${line.name}`} title="Remove" className="rounded-ui p-1 text-muted hover:bg-surface-muted hover:text-danger disabled:opacity-40">
            <Icon name="trash" className="size-4" />
          </button>
        </div>
        <span className="font-semibold tabular-nums">{line.lineTotal !== undefined ? formatMoney(line.lineTotal) : "—"}</span>
      </div>
    </li>
  );
}

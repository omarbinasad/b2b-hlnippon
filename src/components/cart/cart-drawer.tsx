"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { removeCartLineAction, updateCartLineAction } from "@/app/(store)/actions";
import { Button, ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
import { cx } from "@/lib/cx";
import { formatMoney } from "@/lib/format";
import type { Cart, CartLine } from "@/lib/types";
import { CartQuantityStepper } from "./quantity-stepper";

export type CartDrawerAccess = "guest" | "pending" | "approved" | "admin";

const NOT_SHOPPER: Record<Exclude<CartDrawerAccess, "approved">, string> = {
  guest: "Log in with your business account to order. New here? Apply for a wholesale account.",
  pending: "Your business account is awaiting approval. You can order once it is approved.",
  admin: "Admin preview: the cart is for approved customers (switch “Demo view” to Approved customer to try it).",
};

/**
 * Header cart button + right-hand cart panel: lines (quantity, remove), subtotal, View cart and Checkout. Data comes
 * from the server with the header (re-rendered after every cart change); this only shows it and sends changes.
 */
export function CartDrawer({ access, cart, showLabel, className }: { access: CartDrawerAccess; cart?: Cart; showLabel?: boolean; className?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const count = cart?.lines.length ?? 0;

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={count > 0 ? `Cart (${count})` : "Cart"}
        className={cx("relative inline-flex items-center gap-2 rounded-ui px-2 py-2 text-sm font-medium text-muted hover:text-foreground", className)}
      >
        <span className="relative">
          <Icon name="cart" className="size-5" />
          {count > 0 && (
            <span aria-hidden="true" className="absolute -top-2 -right-2.5 grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[0.625rem] leading-none font-semibold text-brand-contrast tabular-nums">
              {count > 99 ? "99+" : count}
            </span>
          )}
        </span>
        {showLabel && <span className="hidden lg:inline">Cart</span>}
      </button>

      <dialog
        ref={ref}
        aria-labelledby="cart-drawer-title"
        onClose={() => setOpen(false)}
        onClick={(e) => {
          // A click on the backdrop (outside the panel) closes it.
          if (e.target === e.currentTarget) setOpen(false);
        }}
        className="fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-none w-[min(26rem,100vw)] max-w-none bg-surface p-0 text-foreground shadow-2xl backdrop:bg-black/50 open:animate-[cart-in_200ms_ease-out] motion-reduce:open:animate-none"
      >
        {open && <Panel access={access} cart={cart} onClose={() => setOpen(false)} />}
      </dialog>
    </>
  );
}

function Panel({ access, cart, onClose }: { access: CartDrawerAccess; cart?: Cart; onClose: () => void }) {
  const lines = cart?.lines ?? [];
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
        <h2 id="cart-drawer-title" className="text-lg font-semibold">
          Your cart{lines.length > 0 && <span className="ml-1.5 text-sm font-normal text-muted">({lines.length} {lines.length === 1 ? "product" : "products"})</span>}
        </h2>
        <button type="button" onClick={onClose} aria-label="Close cart" className="rounded-ui p-1.5 text-muted hover:bg-surface-muted hover:text-foreground">
          <Icon name="close" className="size-5" />
        </button>
      </div>

      {access !== "approved" ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <Icon name="lock" className="size-8 text-muted" />
          <p className="text-sm">{NOT_SHOPPER[access]}</p>
          {access === "guest" && (
            <div className="flex gap-2">
              <ButtonLink href="/login" size="sm" onClick={onClose}>Log in</ButtonLink>
              <ButtonLink href="/register" size="sm" variant="secondary" onClick={onClose}>Apply</ButtonLink>
            </div>
          )}
        </div>
      ) : lines.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <Icon name="cart" className="size-8 text-muted" />
          <p className="text-sm">Your cart is empty.</p>
          <div className="flex gap-2">
            <ButtonLink href="/shop" size="sm" onClick={onClose}>Browse products</ButtonLink>
            <ButtonLink href="/account/quick-order" size="sm" variant="secondary" onClick={onClose}>Quick order</ButtonLink>
          </div>
        </div>
      ) : (
        <>
          <ul className="flex-1 divide-y divide-line overflow-y-auto px-5">
            {lines.map((line) => <DrawerLine key={line.id} line={line} onNavigate={onClose} />)}
          </ul>
          <div className="space-y-3 border-t border-line px-5 py-4">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-medium">Subtotal</span>
              <span className="text-lg font-semibold tabular-nums">{formatMoney(cart!.itemsSubtotal)}</span>
            </div>
            <p className="text-xs text-muted">Delivery charge and tax are calculated at checkout.</p>
            {!cart!.valid && <p className="text-xs text-danger">Fix the highlighted items before checkout.</p>}
            <div className="grid grid-cols-2 gap-2">
              <ButtonLink href="/cart" variant="secondary" onClick={onClose}>View cart</ButtonLink>
              {cart!.valid ? (
                <ButtonLink href="/checkout" onClick={onClose}>Checkout</ButtonLink>
              ) : (
                <Button disabled>Checkout</Button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function DrawerLine({ line, onNavigate }: { line: CartLine; onNavigate: () => void }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const change = (quantity: number) =>
    startTransition(async () => {
      const r = quantity > 0 ? await updateCartLineAction(line.id, quantity) : await removeCartLineAction(line.id);
      setMessage(r.ok ? "" : r.message);
    });

  return (
    <li className={cx("flex gap-3 py-4", pending && "opacity-60")}>
      <div className="relative size-16 shrink-0 overflow-hidden rounded-ui bg-surface-muted">
        {line.image ? <Image src={line.image.src} alt="" fill sizes="64px" className="object-contain" /> : <Icon name="box" className="absolute inset-0 m-auto size-5 text-muted" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            {line.slug ? (
              <Link href={`/shop/${line.slug}`} onClick={onNavigate} className="text-sm font-medium hover:text-brand hover:underline">{line.name}</Link>
            ) : (
              <span className="text-sm font-medium">{line.name}</span>
            )}
            {line.variationLabel && <p className="text-xs text-muted">{line.variationLabel}</p>}
            {line.unitPrice !== undefined && (
              <p className="text-xs text-muted tabular-nums">
                {formatMoney(line.unitPrice)} / {line.unitLabel}
                {line.priceNote && ` · ${line.priceNote}`}
              </p>
            )}
          </div>
          <button type="button" onClick={() => change(0)} disabled={pending} aria-label={`Remove ${line.name}`} className="rounded-ui p-1 text-muted hover:bg-surface-muted hover:text-danger">
            <Icon name="trash" className="size-4" />
          </button>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <CartQuantityStepper name={line.name} quantity={line.quantity} min={line.minQuantity} max={line.maxQuantity} step={line.step} disabled={pending} invalid={Boolean(line.error)} onChange={change} />
          <span className="text-sm font-semibold tabular-nums">{line.lineTotal !== undefined ? formatMoney(line.lineTotal) : "—"}</span>
        </div>
        {(line.error || message) && <p className="mt-1 text-xs text-danger">{message || line.error}</p>}
      </div>
    </li>
  );
}

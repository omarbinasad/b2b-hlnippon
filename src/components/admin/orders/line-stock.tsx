"use client";

import { useCan } from "@/components/admin/capabilities-context";
import { useState, useTransition } from "react";
import { setLineStockAction } from "@/app/admin/orders/actions";
import { StockBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import type { LineStock } from "@/lib/orders/stock";

/**
 * Current catalog stock for an order line, with a control to mark the product (or option) in/out of
 * stock or set its counted quantity. This changes the product everywhere on the site; the order's items
 * and amounts are not touched (remove or replace the item separately if needed).
 */
export function LineStockControl({ orderId, productId, variationId, itemName, info }: {
  orderId: string;
  productId: string;
  variationId?: string;
  itemName: string;
  info: LineStock | null;
}) {
  const canChange = useCan()("order_stock.edit");
  const [open, setOpen] = useState(false);
  const [quantity, setQuantity] = useState(String(info?.stock.quantity ?? 0));
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const p = `stock-${productId}-${variationId ?? "p"}`;

  if (!info) return <p className="mt-1 text-xs text-muted">Product no longer in the catalog.</p>;

  const close = () => {
    setOpen(false);
    setQuantity(String(info.stock.quantity ?? 0));
    setMessage("");
  };
  const apply = (change: { status: "in_stock" | "out_of_stock" } | { quantity: number }) =>
    startTransition(async () => {
      const r = await setLineStockAction(orderId, productId, variationId, change);
      if (r.ok) close();
      else setMessage(r.message);
    });

  const out = info.stock.status === "out_of_stock";
  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
      <span className="text-muted">Stock now:</span>
      <StockBadge status={info.stock.status} />
      {info.mode === "quantity" && <span className="tabular-nums text-muted">{info.stock.quantity ?? 0} left</span>}
      {info.unavailable ? (
        <span className="text-muted">{info.unavailable}</span>
      ) : canChange && (
        <button type="button" onClick={() => setOpen(true)} className="font-medium text-brand hover:underline" aria-label={`Change stock for ${itemName}`}>
          Change stock
        </button>
      )}
      <Dialog
        open={open}
        onClose={close}
        title={`Stock: ${itemName}`}
        description={
          <>
            Changes the product&apos;s stock everywhere on the site. This order and its amounts stay as they are.
            {info.shared && <span className="block">This option shares the product&apos;s stock, so every option using it changes too.</span>}
          </>
        }
      >
        {info.mode === "status" ? (
          <div className="space-y-4">
            <p className="text-sm">Now: <StockBadge status={info.stock.status} /></p>
            <p role="alert" className="text-sm text-danger">{message}</p>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="secondary" onClick={close}>Cancel</Button>
              <Button variant={out ? "primary" : "danger"} disabled={pending} onClick={() => apply({ status: out ? "in_stock" : "out_of_stock" })}>
                {pending ? "Saving…" : out ? "Mark in stock" : "Mark out of stock"}
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); apply({ quantity: quantity.trim() === "" ? Number.NaN : Number(quantity) }); }} className="space-y-4" noValidate>
            <Field id={`${p}-qty`} label="Quantity in stock" hint="Counted stock: 0 = out of stock; the status follows the quantity.">
              <Input id={`${p}-qty`} type="number" inputMode="numeric" min={0} step={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} aria-describedby={`${p}-qty-hint`} />
            </Field>
            <p role="alert" className="text-sm text-danger">{message}</p>
            <div className="flex flex-wrap justify-end gap-2">
              {!out && <Button variant="ghost" disabled={pending} onClick={() => apply({ quantity: 0 })}>Set to 0 (out of stock)</Button>}
              <Button variant="secondary" onClick={close}>Cancel</Button>
              <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save quantity"}</Button>
            </div>
          </form>
        )}
      </Dialog>
    </div>
  );
}

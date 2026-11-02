"use client";

import { useState, useTransition } from "react";
import { editOrderAction, getOrderableProductAction, quoteOrderLineAction } from "@/app/admin/orders/actions";
import { ProductSearch } from "@/components/admin/products/product-search";
import { StockBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Icon } from "@/components/ui/icons";
import { formatMoney } from "@/lib/format";
import type { FieldErrors, OrderableProduct, OrderItem } from "@/lib/types";
import { EditPreview, useEditPreview } from "./edit-preview";
import { AMOUNT_STEP } from "@/lib/orders/calc";

const amount = (v: string) => (v.trim() === "" ? Number.NaN : Number(v));
/** aria-describedby for a Field control: its error, else its hint. */
const describedBy = (id: string, error?: string, hasHint = true) => (error ? `${id}-error` : hasHint ? `${id}-hint` : undefined);

function ReasonField({ id, value, onChange, error, placeholder }: { id: string; value: string; onChange: (v: string) => void; error?: string; placeholder: string }) {
  return (
    <Field id={id} label="Reason" required hint="Required. Kept in the order's change history." error={error}>
      <Textarea id={id} value={value} onChange={(e) => onChange(e.target.value)} maxLength={300} placeholder={placeholder} aria-invalid={Boolean(error)} aria-describedby={describedBy(id, error)} />
    </Field>
  );
}

/** Removes one item from the order (with a reason); the totals are recalculated. `lastItem`: disabled (cancel the order instead). */
export function RemoveItemButton({ orderId, item, lastItem = false }: { orderId: string; item: OrderItem; lastItem?: boolean }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const p = `rm-${item.id}`;
  const preview = useEditPreview(orderId, open ? { kind: "remove", itemId: item.id, reason } : null);

  const close = () => {
    setOpen(false);
    setReason("");
    setErrors({});
    setMessage("");
  };
  const save = () =>
    startTransition(async () => {
      const r = await editOrderAction(orderId, { kind: "remove", itemId: item.id, reason });
      if (r.ok) close();
      else {
        setErrors(r.errors);
        setMessage(r.message);
      }
    });

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        disabled={lastItem}
        title={lastItem ? "An order needs at least one item — cancel the order instead." : undefined}
        aria-label={`Remove ${item.name}`}
        className="text-danger hover:bg-danger-soft"
      >
        <Icon name="trash" className="size-4" /> Remove
      </Button>
      <Dialog open={open} onClose={close} title={`Remove ${item.name}?`} description="Takes the item out of this order. The product stays in the catalog.">
        <form onSubmit={(e) => { e.preventDefault(); save(); }} className="space-y-4" noValidate>
          <p className="text-sm">
            {item.quantity} × {formatMoney(item.unitPrice)} — line total {formatMoney(item.lineTotal)}
          </p>
          <ReasonField id={`${p}-reason`} value={reason} onChange={setReason} error={errors.reason} placeholder="e.g. Out of stock — customer agreed by phone" />
          <EditPreview id={`${p}-preview`} {...preview} idle="Calculating the new total…" />
          <p role="alert" className="text-sm text-danger">{message}</p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={close}>Cancel</Button>
            <Button type="submit" variant="danger" disabled={pending}>{pending ? "Removing…" : "Remove item"}</Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

/**
 * Adds a product line to the order at this customer's price — or, with `replace`, swaps an item for
 * another product in one step. The price can be agreed manually; the server re-checks everything.
 */
/** `customerId` absent = walk-in order (catalog prices). */
export function AddItemButton({ orderId, customerId, excludeIds, replace, variant = "primary", label = "Add item" }: {
  orderId: string;
  customerId?: string;
  excludeIds: string[];
  replace?: OrderItem;
  variant?: "primary" | "secondary" | "ghost";
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [product, setProduct] = useState<OrderableProduct | null>(null);
  const [option, setOption] = useState(0);
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("");
  const [priceEdited, setPriceEdited] = useState(false);
  const [discount, setDiscount] = useState("0");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState("");
  const [loadingProduct, startLoading] = useTransition();
  const [pending, startTransition] = useTransition();
  const p = `add-${replace?.id ?? "new"}`;
  const opt = product?.options[option];

  const edit = product && opt
    ? { kind: "add", productId: product.productId, variationId: opt.variationId, quantity: amount(quantity), unitPrice: amount(unitPrice), discount: amount(discount || "0"), reason, replaceItemId: replace?.id }
    : null;
  const preview = useEditPreview(orderId, open ? edit : null);

  const reset = () => {
    setProduct(null);
    setOption(0);
    setQuantity("1");
    setUnitPrice("");
    setPriceEdited(false);
    setDiscount("0");
    setReason("");
    setErrors({});
    setMessage("");
  };
  const close = () => {
    setOpen(false);
    reset();
  };

  // Customer price for the chosen option at this quantity (bulk tiers), unless the price was agreed manually.
  const requote = (prod: OrderableProduct, index: number, qty: number, edited: boolean) => {
    if (edited || !Number.isInteger(qty) || qty < 1) return;
    startLoading(async () => {
      const q = await quoteOrderLineAction(customerId, prod.productId, prod.options[index].variationId, qty);
      if (q) setUnitPrice(String(q.unitPrice));
    });
  };

  const pick = (productId: string) =>
    startLoading(async () => {
      setMessage("");
      const prod = await getOrderableProductAction(productId, customerId);
      if (!prod) {
        setMessage(customerId ? "This product has no price for this customer (or the customer isn't approved), so it can't be added." : "This product has no catalog price, so it can't be added.");
        return;
      }
      const first = prod.options[0];
      setProduct(prod);
      setOption(0);
      setQuantity(String(first.minQuantity));
      setUnitPrice(String(first.customerPrice));
      setPriceEdited(false);
    });

  const save = () =>
    startTransition(async () => {
      if (!edit) return;
      const r = await editOrderAction(orderId, edit);
      if (r.ok) close();
      else {
        setErrors(r.errors);
        setMessage(r.message);
      }
    });

  return (
    <>
      <Button variant={replace ? "ghost" : variant} size="sm" onClick={() => setOpen(true)} aria-label={replace ? `Replace ${replace.name}` : undefined}>
        {replace ? "Replace" : <><Icon name="plus" className="size-4" /> {label}</>}
      </Button>
      <Dialog
        open={open}
        onClose={close}
        title={replace ? `Replace ${replace.name}` : "Add an item"}
        description={replace ? `The new product takes the place of ${replace.quantity} × ${replace.name} (${formatMoney(replace.lineTotal)}).` : customerId ? "Priced for this customer. Catalog prices are not changed." : "Walk-in order: catalog prices (customer price rules need an account)."}
      >
        <form onSubmit={(e) => { e.preventDefault(); save(); }} className="space-y-4" noValidate>
          {!product ? (
            <ProductSearch id={`${p}-search`} label="Find a product by name or SKU" excludeIds={excludeIds} onPick={(pk) => pick(pk.id)} pickLabel="Choose" />
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-ui border border-line p-3 text-sm">
              <div>
                <p className="font-medium">{product.name}</p>
                {opt && <p className="text-xs text-muted">{opt.sku} · per {product.unitLabel}{product.pricedByWeight ? " · priced by weight" : ""}</p>}
              </div>
              <Button variant="ghost" size="sm" onClick={reset}>Change product</Button>
            </div>
          )}
          {errors.productId && <p className="text-sm text-danger">{errors.productId}</p>}

          {product && opt && (
            <>
              {product.options.length > 1 || opt.variationId ? (
                <Field id={`${p}-option`} label="Option" error={errors.variationId}>
                  <Select
                    id={`${p}-option`}
                    value={option}
                    onChange={(e) => {
                      const i = Number(e.target.value);
                      setOption(i);
                      setQuantity(String(product.options[i].minQuantity));
                      setUnitPrice(String(product.options[i].customerPrice));
                      setPriceEdited(false);
                    }}
                  >
                    {product.options.map((o, i) => (
                      <option key={o.variationId ?? i} value={i} disabled={!o.available}>
                        {o.label || o.sku}{o.available ? "" : " (disabled)"}
                      </option>
                    ))}
                  </Select>
                </Field>
              ) : null}
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted">Stock now:</span> <StockBadge status={opt.stock.status} />
                {opt.stock.status === "out_of_stock" && <span className="text-xs text-danger">Out of stock — check before adding.</span>}
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field
                  id={`${p}-qty`}
                  label="Quantity"
                  hint={`Min ${opt.minQuantity}${opt.maxQuantity ? ` · max ${opt.maxQuantity}` : ""}`}
                  error={errors.quantity}
                >
                  <Input
                    id={`${p}-qty`}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    step={1}
                    value={quantity}
                    onChange={(e) => {
                      setQuantity(e.target.value);
                      requote(product, option, Number(e.target.value), priceEdited);
                    }}
                    aria-invalid={Boolean(errors.quantity)}
                    aria-describedby={describedBy(`${p}-qty`, errors.quantity)}
                  />
                </Field>
                <Field id={`${p}-price`} label={`Unit price (per ${product.unitLabel})`} hint={loadingProduct ? "Updating price…" : `${customerId ? "Customer" : "Catalog"} price ${formatMoney(opt.customerPrice)} at min qty`} error={errors.unitPrice}>
                  <Input
                    id={`${p}-price`}
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step={AMOUNT_STEP}
                    value={unitPrice}
                    onChange={(e) => {
                      setUnitPrice(e.target.value);
                      setPriceEdited(true);
                    }}
                    aria-invalid={Boolean(errors.unitPrice)}
                    aria-describedby={describedBy(`${p}-price`, errors.unitPrice)}
                  />
                </Field>
                <Field id={`${p}-discount`} label="Line discount" error={errors.discount}>
                  <Input id={`${p}-discount`} type="number" inputMode="decimal" min={0} step={AMOUNT_STEP} value={discount} onChange={(e) => setDiscount(e.target.value)} aria-invalid={Boolean(errors.discount)} aria-describedby={describedBy(`${p}-discount`, errors.discount, false)} />
                </Field>
              </div>
              <ReasonField id={`${p}-reason`} value={reason} onChange={setReason} error={errors.reason} placeholder={replace ? "e.g. Original item out of stock — customer accepted this instead" : "e.g. Customer added by phone"} />
              <EditPreview id={`${p}-preview`} {...preview} lineLabel="New line total" idle="Enter a quantity and price to see the new totals." />
            </>
          )}

          <p role="alert" className="text-sm text-danger">{message}</p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={close}>Cancel</Button>
            <Button type="submit" disabled={pending || !edit}>{pending ? "Saving…" : replace ? "Replace item" : "Add to order"}</Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

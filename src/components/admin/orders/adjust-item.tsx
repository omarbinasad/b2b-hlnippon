"use client";

import { useState, useTransition } from "react";
import { adjustOrderItemAction } from "@/app/admin/orders/actions";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Icon } from "@/components/ui/icons";
import { siteConfig } from "@/config/site";
import { formatMoney, formatWeight } from "@/lib/format";
import { isValidAmount, toGrams, type TaxRates, amountStep } from "@/lib/orders/calc";
import { previewOrderAdjustment } from "@/lib/orders/assemble";
import type { Order } from "@/lib/types";
import type { FieldErrors, OrderItem, Weight } from "@/lib/types";

interface AdjustItemProps {
  orderId: string;
  item: OrderItem;
  index: number;
  /** Current order (items, shipping, refunds, tax snapshot, discount) for the live before/after preview. */
  order: Pick<Order, "items" | "shipping" | "refunds" | "taxSnapshot" | "discount">;
  /** Quantity can change (until delivery). */
  allowQuantity?: boolean;
  /** Agreed unit price can change. */
  allowPrice?: boolean;
  /** Packed weight can change. */
  allowWeight?: boolean;
  /** Placeholder class rates for older orders without a tax snapshot. */
  taxRates: TaxRates;
}

/**
 * Order-level change to one line's quantity (until delivery), fulfilled weight and/or agreed unit price.
 * Never touches the catalog product. The preview uses the same pure calculator
 * as the server; the server recalculates and records the audit entry on save.
 */
export function AdjustItemButton({ orderId, item, index, order, taxRates, allowQuantity = false, allowPrice = true, allowWeight = true }: AdjustItemProps) {
  const current = item.fulfilledWeight ?? item.orderedWeight;
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState(String(item.quantity));
  const [price, setPrice] = useState(String(item.unitPrice));
  const [weightValue, setWeightValue] = useState(String(current.value));
  const [weightUnit, setWeightUnit] = useState<Weight["unit"]>(current.unit);
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const p = `adj-${item.id}`;

  const reset = () => {
    setQty(String(item.quantity));
    setPrice(String(item.unitPrice));
    setWeightValue(String(current.value));
    setWeightUnit(current.unit);
    setReason("");
    setErrors({});
    setMessage("");
  };

  const qtyNum = qty.trim() === "" ? Number.NaN : Number(qty);
  const qtyOk = Number.isInteger(qtyNum) && qtyNum >= 1;
  const qtyChanged = allowQuantity && qtyOk && qtyNum !== item.quantity;
  const priceNum = price.trim() === "" ? Number.NaN : Number(price);
  const weightNum = weightValue.trim() === "" ? Number.NaN : Number(weightValue);
  const priceOk = isValidAmount(priceNum);
  const weightOk = Number.isFinite(weightNum) && weightNum > 0;
  const newWeight: Weight = { value: weightNum, unit: weightUnit };
  const priceChanged = priceOk && priceNum !== item.unitPrice;
  const weightChanged = weightOk && toGrams(newWeight) !== toGrams(current);
  const preview =
    priceOk && weightOk && (!allowQuantity || qtyOk) && (priceChanged || weightChanged || qtyChanged)
      ? previewOrderAdjustment(order, index, { quantity: qtyChanged ? qtyNum : undefined, unitPrice: priceNum, fulfilledWeight: newWeight }, taxRates)
      : undefined;

  const save = () =>
    startTransition(async () => {
      setMessage("");
      const result = await adjustOrderItemAction(orderId, {
        itemId: item.id,
        quantity: allowQuantity && (!qtyOk || qtyChanged) ? qtyNum : undefined,
        // Send only what changed (invalid input is sent so the server reports it).
        unitPrice: !priceOk || priceChanged ? priceNum : undefined,
        fulfilledWeight: !weightOk || weightChanged ? newWeight : undefined,
        reason,
      });
      if (result.ok) {
        setOpen(false);
        reset();
      } else {
        setErrors(result.errors);
        setMessage(result.message);
      }
    });

  const err = (key: string) => errors[key];
  const describedBy = (key: string, hint = true) => (err(key) ? `${p}-${key}-error` : hint ? `${p}-${key}-hint` : undefined);

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)} aria-label={`Adjust ${item.name}`}>
        <Icon name="pencil" className="size-4" /> Adjust
      </Button>
      <Dialog
        open={open}
        onClose={() => {
          setOpen(false);
          reset();
        }}
        className="w-[min(38rem,calc(100vw-2rem))]"
        title={`Adjust ${item.name}`}
        description={
          <>
            {item.attributes && <span className="block font-medium text-foreground">{Object.entries(item.attributes).map(([k, v]) => `${k}: ${v}`).join(", ")}</span>}
            Changes this order only — the catalog price and product weight stay the same.
          </>
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
          className="space-y-4"
          noValidate
        >
          <section aria-label="Currently on this order" className="rounded-ui border border-line bg-surface-muted p-3">
            <h3 className="text-xs font-semibold tracking-wide text-muted uppercase">Currently on this order</h3>
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
              <div><dt className="text-xs text-muted">Quantity</dt><dd className="font-medium tabular-nums">{item.quantity} {item.unitLabel}</dd></div>
              <div><dt className="text-xs text-muted">Unit price</dt><dd className="font-medium tabular-nums">{formatMoney(item.unitPrice)}</dd></div>
              <div><dt className="text-xs text-muted">Weight</dt><dd className="font-medium tabular-nums">{formatWeight(current)}</dd></div>
              <div><dt className="text-xs text-muted">Line total</dt><dd className="font-medium tabular-nums">{formatMoney(item.lineTotal)}</dd></div>
            </dl>
            <p className="mt-2 text-xs text-muted">
              Catalog price {formatMoney(item.catalogUnitPrice)} per {item.unitLabel} ·{" "}
              {item.pricedByWeight ? "priced by weight: the line amount follows the packed weight" : "fixed price: weight is recorded only"}
            </p>
          </section>

          <h3 className="text-sm font-semibold">New values</h3>
          {allowQuantity && (
            <Field id={`${p}-quantity`} label={`Quantity (${item.unitLabel})`} hint="The ordered weight follows the quantity. The unit price stays unless you change it." error={err("quantity")}>
              <Input
                id={`${p}-quantity`}
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                aria-invalid={Boolean(err("quantity"))}
                aria-describedby={describedBy("quantity")}
                className="sm:max-w-40"
              />
            </Field>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            {allowPrice && <Field
              id={`${p}-unitPrice`}
              label={`Unit price (per ${item.unitLabel}, ${siteConfig.currencySymbol})`}
              hint="The price agreed with the customer for this order."
              error={err("unitPrice")}
            >
              <Input
                id={`${p}-unitPrice`}
                type="number"
                inputMode="decimal"
                min={0}
                step={amountStep()}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                aria-invalid={Boolean(err("unitPrice"))}
                aria-describedby={describedBy("unitPrice")}
              />
            </Field>}
            {allowWeight && <div className="space-y-1.5">
              <label htmlFor={`${p}-fulfilledWeight`} className="block text-sm font-medium">Packed (delivered) weight</label>
              <div className="flex gap-2">
                <Input
                  id={`${p}-fulfilledWeight`}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.001"
                  value={weightValue}
                  onChange={(e) => setWeightValue(e.target.value)}
                  aria-invalid={Boolean(err("fulfilledWeight"))}
                  aria-describedby={describedBy("fulfilledWeight")}
                />
                <Select aria-label="Weight unit" value={weightUnit} onChange={(e) => setWeightUnit(e.target.value as Weight["unit"])} className="w-20">
                  <option value="kg">kg</option>
                  <option value="g">g</option>
                </Select>
              </div>
              {err("fulfilledWeight") ? (
                <p id={`${p}-fulfilledWeight-error`} className="text-xs text-danger">{err("fulfilledWeight")}</p>
              ) : (
                <p id={`${p}-fulfilledWeight-hint`} className="text-xs text-muted">
                  Ordered {formatWeight(item.orderedWeight)}. {item.pricedByWeight ? "Changes the line amount." : "Does not change the price."}
                </p>
              )}
            </div>}
          </div>

          <Field id={`${p}-reason`} label="Reason" required hint="Required. Kept in the order's audit history." error={err("reason")}>
            <Textarea
              id={`${p}-reason`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={300}
              placeholder="e.g. Packed weight 10.4 kg on scale #2"
              aria-invalid={Boolean(err("reason"))}
              aria-describedby={describedBy("reason")}
            />
          </Field>

          <section aria-labelledby={`${p}-preview`} className="rounded-ui border border-line bg-surface-muted p-3 text-sm">
            <h3 id={`${p}-preview`} className="font-medium">Preview</h3>
            {preview ? (
              <dl className="mt-2 space-y-1 tabular-nums [&>div]:flex [&>div]:justify-between [&>div]:gap-4">
                <div><dt>Line total</dt><dd>{formatMoney(preview.lineBefore.total)} → <strong>{formatMoney(preview.lineAfter.total)}</strong></dd></div>
                <div><dt>Order total (incl. tax)</dt><dd>{formatMoney(preview.totalBefore)} → <strong>{formatMoney(preview.totalAfter)}</strong></dd></div>
                <div>
                  <dt>Difference</dt>
                  <dd className={preview.difference < 0 ? "text-danger" : undefined}>{preview.difference > 0 ? "+" : ""}{formatMoney(preview.difference)}</dd>
                </div>
              </dl>
            ) : (
              <p className="mt-1 text-muted">Change the {allowQuantity ? "quantity, " : ""}price or weight to see the new line and order totals.</p>
            )}
            <p className="mt-2 text-xs text-muted">The server recalculates and stores the final amounts when you save. Payment is not re-charged or refunded.</p>
          </section>

          <p role="alert" className="text-sm text-danger">{message}</p>
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setOpen(false);
                reset();
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save adjustment"}</Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

"use client";

import { useState, useTransition } from "react";
import { editOrderAction } from "@/app/admin/orders/actions";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { formatMoney } from "@/lib/format";
import type { FieldErrors, OrderDiscount } from "@/lib/types";
import { EditPreview, useEditPreview } from "./edit-preview";
import { amountStep } from "@/lib/orders/calc";
import { siteConfig } from "@/config/site";

/**
 * Adds, changes or removes the order-level discount (fixed or a percentage of the items after
 * line discounts, applied before tax). Catalog prices and price rules are not changed.
 */
export function OrderDiscountButton({ orderId, current, amount }: { orderId: string; current?: OrderDiscount; amount?: number }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<OrderDiscount["type"]>(current?.type ?? "fixed");
  const [value, setValue] = useState(current ? String(current.value) : "");
  const [removing, setRemoving] = useState(false);
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const p = `disc-${orderId}`;

  const parsed = value.trim() === "" ? Number.NaN : Number(value);
  const edit = removing ? { kind: "discount", discount: null, reason } : Number.isFinite(parsed) ? { kind: "discount", discount: { type, value: parsed }, reason } : null;
  const preview = useEditPreview(orderId, open ? edit : null);

  const close = () => {
    setOpen(false);
    setType(current?.type ?? "fixed");
    setValue(current ? String(current.value) : "");
    setRemoving(false);
    setReason("");
    setErrors({});
    setMessage("");
  };
  const save = () =>
    startTransition(async () => {
      if (!edit) {
        setErrors({ value: "Enter the discount." });
        return;
      }
      const r = await editOrderAction(orderId, edit);
      if (r.ok) close();
      else {
        setErrors(r.errors);
        setMessage(r.message);
      }
    });

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>{current ? "Edit order discount" : "Add order discount"}</Button>
      <Dialog
        open={open}
        onClose={close}
        title={current ? "Order discount" : "Add an order discount"}
        description={
          current
            ? `Now ${current.type === "percent" ? `${current.value}%` : formatMoney(current.value)}${amount !== undefined ? ` (−${formatMoney(amount)})` : ""}. Applied to the items after line discounts, before tax.`
            : "Applied to the items after line discounts, before tax. This order only."
        }
      >
        <form onSubmit={(e) => { e.preventDefault(); save(); }} className="space-y-4" noValidate>
          {!removing && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id={`${p}-type`} label="Type" error={errors.type}>
                <Select id={`${p}-type`} value={type} onChange={(e) => setType(e.target.value as OrderDiscount["type"])}>
                  <option value="fixed">Fixed amount ({siteConfig.currencySymbol})</option>
                  <option value="percent">Percentage (%)</option>
                </Select>
              </Field>
              <Field id={`${p}-value`} label={type === "percent" ? "Percentage" : "Amount"} hint={type === "percent" ? "Above 0, at most 100." : "Up to the items total."} error={errors.value}>
                <Input
                  id={`${p}-value`}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={type === "percent" ? 100 : undefined}
                  step={type === "percent" ? "0.01" : amountStep()}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  aria-invalid={Boolean(errors.value)}
                  aria-describedby={errors.value ? `${p}-value-error` : `${p}-value-hint`}
                />
              </Field>
            </div>
          )}
          {removing && <p className="text-sm">The discount will be removed and the totals recalculated.</p>}
          <Field id={`${p}-reason`} label="Reason" required hint="Required. Kept in the order's change history." error={errors.reason}>
            <Textarea
              id={`${p}-reason`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={300}
              placeholder={removing ? "e.g. Discount added by mistake" : "e.g. Loyalty discount agreed with the customer"}
              aria-invalid={Boolean(errors.reason)}
              aria-describedby={errors.reason ? `${p}-reason-error` : `${p}-reason-hint`}
            />
          </Field>
          <EditPreview id={`${p}-preview`} {...preview} idle="Enter the discount to see the new total." />
          <p role="alert" className="text-sm text-danger">{message}</p>
          <div className="flex flex-wrap justify-between gap-2">
            {current ? (
              <Button variant="ghost" onClick={() => { setRemoving(!removing); setErrors({}); setMessage(""); }}>
                {removing ? "Keep a discount" : "Remove discount"}
              </Button>
            ) : <span />}
            <div className="flex gap-2">
              <Button variant="secondary" onClick={close}>Cancel</Button>
              <Button type="submit" variant={removing ? "danger" : "primary"} disabled={pending}>
                {pending ? "Saving…" : removing ? "Remove discount" : "Save discount"}
              </Button>
            </div>
          </div>
        </form>
      </Dialog>
    </>
  );
}

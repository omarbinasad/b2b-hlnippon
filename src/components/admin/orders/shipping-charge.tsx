"use client";

import { useState, useTransition } from "react";
import { editOrderAction } from "@/app/admin/orders/actions";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/field";
import { formatMoney } from "@/lib/format";
import { AMOUNT_STEP } from "@/lib/orders/calc";
import type { FieldErrors } from "@/lib/types";
import { EditPreview, useEditPreview } from "./edit-preview";

/** Sets an agreed delivery charge on an existing order (recalculated with the order's own tax basis; kept in the history). */
export function ShippingChargeButton({ orderId, label, amount }: { orderId: string; label: string; amount: number }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(label);
  const [value, setValue] = useState(String(amount));
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const p = `ship-${orderId}`;

  const parsed = value.trim() === "" ? Number.NaN : Number(value);
  const edit = Number.isFinite(parsed) ? { kind: "shipping", label: name, amount: parsed, reason } : null;
  const preview = useEditPreview(orderId, open ? edit : null);

  const close = () => {
    setOpen(false);
    setName(label);
    setValue(String(amount));
    setReason("");
    setErrors({});
    setMessage("");
  };
  const save = () =>
    startTransition(async () => {
      if (!edit) {
        setErrors({ amount: "Enter the delivery charge." });
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
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>Change charge</Button>
      <Dialog open={open} onClose={close} title="Delivery charge" description={`Now ${formatMoney(amount)} (${label}). The new charge is saved as an agreed amount; shipping rules are not re-applied.`}>
        <form onSubmit={(e) => { e.preventDefault(); save(); }} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_10rem]">
            <Field id={`${p}-label`} label="Label" required error={errors.label}>
              <Input id={`${p}-label`} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} aria-invalid={Boolean(errors.label)} aria-describedby={errors.label ? `${p}-label-error` : undefined} />
            </Field>
            <Field id={`${p}-amount`} label="Amount" required error={errors.amount}>
              <Input
                id={`${p}-amount`}
                type="number"
                inputMode="numeric"
                min={0}
                step={AMOUNT_STEP}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                aria-invalid={Boolean(errors.amount)}
                aria-describedby={errors.amount ? `${p}-amount-error` : undefined}
              />
            </Field>
          </div>
          <Field id={`${p}-reason`} label="Reason" required hint="Required. Kept in the order's change history." error={errors.reason}>
            <Textarea
              id={`${p}-reason`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={300}
              placeholder="e.g. Free delivery agreed for the first order"
              aria-invalid={Boolean(errors.reason)}
              aria-describedby={errors.reason ? `${p}-reason-error` : `${p}-reason-hint`}
            />
          </Field>
          <EditPreview id={`${p}-preview`} {...preview} idle="Enter the charge to see the new total." />
          <p role="alert" className="text-sm text-danger">{message}</p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={close}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save charge"}</Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

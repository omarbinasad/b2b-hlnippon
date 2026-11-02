"use client";

import { useState, useTransition } from "react";
import { recordPaymentAction } from "@/app/admin/orders/actions";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { formatMoney } from "@/lib/format";

/** Bookkeeping: staff confirm a payment received outside the site (bank transfer, cash on delivery). Never charges anyone. */
export function RecordPaymentButton({ orderId, amount, methodLabel }: { orderId: string; amount: number; methodLabel: string }) {
  const [open, setOpen] = useState(false);
  const [reference, setReference] = useState("");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const p = `pay-${orderId}`;

  const close = () => {
    setOpen(false);
    setReference("");
    setMessage("");
  };
  const save = () =>
    startTransition(async () => {
      const r = await recordPaymentAction(orderId, reference);
      if (r.ok) close();
      else setMessage(r.message);
    });

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>Record payment received</Button>
      <Dialog open={open} onClose={close} title="Record payment received" description={`Confirm that ${formatMoney(amount)} was received by ${methodLabel}. This only updates the order — no money is collected here.`}>
        <form onSubmit={(e) => { e.preventDefault(); save(); }} className="space-y-4" noValidate>
          <Field id={`${p}-ref`} label="Reference (optional)" hint="e.g. the bank transfer reference or receipt number.">
            <Input id={`${p}-ref`} value={reference} onChange={(e) => setReference(e.target.value)} maxLength={100} aria-describedby={`${p}-ref-hint`} />
          </Field>
          <p role="alert" className="text-sm text-danger">{message}</p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={close}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Mark as paid"}</Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

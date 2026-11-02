"use client";

import { useState, useTransition } from "react";
import { editOrderAction } from "@/app/admin/orders/actions";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/field";
import type { Address, FieldErrors, OrderAddressInput } from "@/lib/types";
import { AddressEditor, emptyAddress, toAddressInput } from "./address-editor";

/**
 * Replaces the billing or delivery address on this order only (kept in the change history). The customer's
 * address book is not changed, and tax is not re-matched: the order keeps the rates frozen when it was placed.
 */
export function OrderAddressEditButton({
  orderId,
  which,
  current,
  saved,
  phoneOptional,
}: {
  orderId: string;
  which: "billing" | "shipping";
  current?: Address;
  saved: Address[];
  phoneOptional: boolean;
}) {
  const initial = current ? toAddressInput(current) : emptyAddress;
  const [open, setOpen] = useState(false);
  const [address, setAddress] = useState<OrderAddressInput>(initial);
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const p = `addr-${which}-${orderId}`;
  const name = which === "billing" ? "billing address" : "delivery address";

  const close = () => {
    setOpen(false);
    setAddress(initial);
    setReason("");
    setErrors({});
    setMessage("");
  };
  const save = () =>
    startTransition(async () => {
      const r = await editOrderAction(orderId, { kind: "address", which, address, reason });
      if (r.ok) close();
      else {
        setErrors(r.errors);
        setMessage(r.message);
      }
    });

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>Edit</Button>
      <Dialog open={open} onClose={close} className="w-[min(40rem,calc(100vw-2rem))]" title={`Edit ${name}`} description="Changes this order only. The customer's address book is not changed.">
        <form onSubmit={(e) => { e.preventDefault(); save(); }} className="space-y-4" noValidate>
          <AddressEditor id={p} legend={which === "billing" ? "Billing address" : "Delivery address"} saved={saved} value={address} onChange={setAddress} errors={errors} errorPrefix="address" phoneOptional={phoneOptional} />
          <Field id={`${p}-reason`} label="Reason" required hint="Required. Kept in the order's change history." error={errors.reason}>
            <Textarea
              id={`${p}-reason`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={300}
              placeholder="e.g. Customer moved the delivery to their second branch"
              aria-invalid={Boolean(errors.reason)}
              aria-describedby={errors.reason ? `${p}-reason-error` : `${p}-reason-hint`}
            />
          </Field>
          {which === "shipping" && (
            <p className="text-xs text-muted">
              The delivery charge and tax are not recalculated: the order keeps its saved charge and the tax rates frozen when it was placed. Change the delivery charge separately if needed.
            </p>
          )}
          <p role="alert" className="text-sm text-danger">{message}</p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={close}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save address"}</Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

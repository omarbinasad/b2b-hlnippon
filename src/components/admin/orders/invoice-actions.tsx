"use client";

import { useState, useTransition } from "react";
import { issueInvoiceAction } from "@/app/admin/orders/actions";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/field";
import type { InvoiceKind } from "@/lib/types";

const copy: Record<InvoiceKind, { button: string; title: string; text: string }> = {
  invoice: {
    button: "Issue invoice",
    title: "Issue the invoice?",
    text: "The invoice gets a number and is frozen as it is now. Later order changes need a revised invoice; this one is never rewritten.",
  },
  revision: {
    button: "Issue revised invoice",
    title: "Issue a revised invoice?",
    text: "The order changed after the last invoice. A revision with the current amounts replaces it; the previous invoice stays on record.",
  },
  credit_note: {
    button: "Issue credit note",
    title: "Issue a credit note?",
    text: "The order is cancelled. A credit note cancels the last invoice; the invoice stays on record.",
  },
};

/** Issues the next invoice document. One dialog is the confirmation; revisions and credit notes need a reason. */
export function InvoiceActions({ orderId, kind }: { orderId: string; kind: InvoiceKind }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const c = copy[kind];
  const needsReason = kind !== "invoice";

  const close = () => {
    setOpen(false);
    setReason("");
    setError("");
  };
  const issue = () =>
    startTransition(async () => {
      const r = await issueInvoiceAction(orderId, kind, needsReason ? reason : undefined);
      if (r.ok) close();
      else setError(r.errors.reason ?? r.message);
    });

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>{c.button}</Button>
      <Dialog open={open} onClose={close} title={c.title} description={c.text}>
        <form onSubmit={(e) => { e.preventDefault(); issue(); }} className="space-y-4" noValidate>
          {needsReason && (
            <Field id="inv-reason" label="Reason" required hint="Shown on the document." error={error || undefined}>
              <Textarea
                id="inv-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={300}
                placeholder={kind === "revision" ? "e.g. Delivered weights and a removed item" : "e.g. Order cancelled by the customer"}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "inv-reason-error" : "inv-reason-hint"}
              />
            </Field>
          )}
          {!needsReason && error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={close}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending ? "Issuing…" : c.button}</Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { declineQuoteAction, sendQuoteAction } from "@/app/admin/quotations/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/field";
import { amountStep } from "@/lib/orders/calc";
import type { FieldErrors, Quotation } from "@/lib/types";

export function QuoteForm({ quotation: q }: { quotation: Quotation }) {
  const router = useRouter();
  const [prices, setPrices] = useState<Record<string, string>>(() => Object.fromEntries(q.items.map((i) => [i.id, i.quotedUnitPrice?.toString() ?? ""])));
  const [validUntil, setValidUntil] = useState(q.validUntil ?? "");
  const [note, setNote] = useState(q.staffNote ?? "");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState("");
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState("");
  const [pending, start] = useTransition();
  return (
    <Card title={q.status === "quoted" ? "Update the quote" : "Send a quote"} description="Set the agreed unit price for each line. The customer can accept until the date you choose.">
      <form
        noValidate
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await sendQuoteAction(q.id, { prices, validUntil, staffNote: note });
            if (!r.ok) {
              setErrors(r.errors);
              setMessage(r.message);
              return;
            }
            setErrors({});
            setMessage("Quote sent to the demo customer. No email is sent.");
            router.refresh();
          });
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {q.items.map((i) => (
            <Field key={i.id} id={`price-${i.id}`} label={`${i.name}${i.optionLabel ? ` (${i.optionLabel})` : ""} × ${i.quantity}`} required error={errors[`price.${i.id}`]}>
              <Input id={`price-${i.id}`} type="number" min={0} step={amountStep()} value={prices[i.id]} onChange={(e) => setPrices({ ...prices, [i.id]: e.target.value })} aria-invalid={Boolean(errors[`price.${i.id}`])} aria-describedby={errors[`price.${i.id}`] ? `price-${i.id}-error` : undefined} />
            </Field>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="quote-valid" label="Valid until" required error={errors.validUntil}><Input id="quote-valid" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} aria-invalid={Boolean(errors.validUntil)} aria-describedby={errors.validUntil ? "quote-valid-error" : undefined} /></Field>
          <Field id="quote-note" label="Note to the customer"><Textarea id="quote-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Send quote"}</Button>
          <Button variant="ghost" className="text-danger hover:bg-danger-soft" onClick={() => setDeclining(true)}>Decline request</Button>
          <p role="status" className={Object.keys(errors).length ? "text-sm text-danger" : "text-sm text-muted"}>{message}</p>
        </div>
      </form>
      <Dialog open={declining} onClose={() => setDeclining(false)} title={`Decline ${q.number}?`}>
        <form noValidate className="space-y-4" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await declineQuoteAction(q.id, reason); if (!r.ok) return setReasonError(r.errors.reason ?? r.message); setDeclining(false); router.refresh(); }); }}>
          <Field id="decline-reason" label="Reason" required error={reasonError} hint="The customer can see this in the history."><Textarea id="decline-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} aria-invalid={Boolean(reasonError)} /></Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeclining(false)}>Cancel</Button>
            <Button type="submit" variant="danger" disabled={pending}>Decline</Button>
          </div>
        </form>
      </Dialog>
    </Card>
  );
}

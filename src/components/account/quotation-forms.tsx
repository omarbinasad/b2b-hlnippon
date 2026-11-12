"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { requestQuotationAction, respondQuotationAction } from "@/app/account/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Textarea } from "@/components/ui/field";
import { Icon } from "@/components/ui/icons";
import { ProductLinePicker, type PickedLine } from "./product-line-picker";

export function QuotationRequestForm() {
  const router = useRouter();
  const [lines, setLines] = useState<PickedLine[]>([]);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="space-y-6">
      <Card title="Products" description="Add what you'd like a price for. We reply with a quote you can accept or reject.">
        <ProductLinePicker addLabel="Add to request" onAdd={(l) => setLines([...lines, l])} />
        {lines.length > 0 && (
          <ul className="mt-4 divide-y divide-line rounded-ui border border-line">
            {lines.map((l, i) => (
              <li key={`${l.productId}-${l.variationId}-${i}`} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                <span className="min-w-0">{l.name}{l.optionLabel ? ` · ${l.optionLabel}` : ""} <span className="text-xs text-muted">× {l.quantity}</span></span>
                <button type="button" aria-label={`Remove ${l.name}`} onClick={() => setLines(lines.filter((_, j) => j !== i))} className="grid size-8 shrink-0 place-items-center rounded-ui text-danger hover:bg-danger-soft"><Icon name="trash" className="size-4" /></button>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title="Notes">
        <Field id="quote-note" label="Anything we should know?" hint="Delivery timing, regular volumes, substitutions."><Textarea id="quote-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      </Card>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <Button
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await requestQuotationAction({ items: lines, customerNote: note });
            if (!r.ok) return setError(r.errors.items ?? r.message);
            router.push(`/account/quotations/${r.value.id}`);
          })
        }
      >
        {pending ? "Sending…" : "Send request"}
      </Button>
    </div>
  );
}

/** Accept (choosing how to pay, from the methods checkout offers) or reject a quote. */
export function QuotationResponse({ id, methods }: { id: string; methods: { id: string; title: string; description?: string }[] }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [method, setMethod] = useState(methods.length === 1 ? methods[0].id : "");
  const [pending, start] = useTransition();
  const answer = (a: "accept" | "reject") =>
    start(async () => {
      if (a === "accept" && methods.length > 1 && !method) return setError("Choose how you'll pay.");
      const r = await respondQuotationAction(id, a, a === "accept" ? method || undefined : undefined);
      if (!r.ok) return setError(r.message);
      setError("");
      router.refresh();
    });
  return (
    <div className="space-y-3 rounded-ui border border-line bg-surface p-4">
      {methods.length ? (
        <fieldset>
          <legend className="text-sm font-semibold">How you&apos;ll pay</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {methods.map((m) => (
              <label key={m.id} className="flex cursor-pointer gap-3 rounded-ui border border-line p-3 text-sm has-checked:border-brand has-checked:bg-brand-soft">
                <input type="radio" name={`pay-${id}`} value={m.id} checked={method === m.id} onChange={() => { setMethod(m.id); setError(""); }} className="mt-0.5 size-4 accent-brand" />
                <span><span className="block font-medium">{m.title}</span>{m.description && <span className="block text-xs text-muted">{m.description}</span>}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : (
        <p role="note" className="rounded-ui bg-warning-soft p-3 text-sm text-warning">No payment method is available right now, so this quote can&apos;t become an order online. Please contact us to complete it.</p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button disabled={pending || !methods.length} onClick={() => answer("accept")}><Icon name="check" className="size-4" /> Accept quote</Button>
        <Button variant="secondary" disabled={pending} onClick={() => answer("reject")}>Reject quote</Button>
      </div>
      <p className="text-xs text-muted">Accepting creates an order at the quoted prices, waiting for payment. This demo takes no payment.</p>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </div>
  );
}

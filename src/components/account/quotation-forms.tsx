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

export function QuotationResponse({ id }: { id: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const answer = (a: "accept" | "reject") =>
    start(async () => {
      const r = await respondQuotationAction(id, a);
      if (!r.ok) return setError(r.message);
      setError("");
      router.refresh();
    });
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button disabled={pending} onClick={() => answer("accept")}><Icon name="check" className="size-4" /> Accept quote</Button>
        <Button variant="secondary" disabled={pending} onClick={() => answer("reject")}>Reject quote</Button>
      </div>
      <p className="text-xs text-muted">Accepting creates a demo order at the quoted prices. No payment is taken.</p>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </div>
  );
}

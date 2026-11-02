"use client";

import { useState, useTransition } from "react";
import { addOrderNoteAction } from "@/app/admin/orders/actions";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import type { OrderNoteType } from "@/lib/types";

/** Adds an internal note, or a note the customer can read in their portal. Nothing is emailed or texted. */
export function AddOrderNote({ orderId }: { orderId: string }) {
  const [type, setType] = useState<OrderNoteType>("admin");
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          setStatus("");
          const result = await addOrderNoteAction(orderId, type, body);
          if (result.ok) {
            setBody("");
            setError("");
            setStatus(type === "customer" ? "Note added. The customer sees it in their portal; no message was sent." : "Internal note added.");
          } else setError(result.message);
        });
      }}
      className="space-y-3"
    >
      <fieldset>
        <legend className="text-sm font-medium">Note type</legend>
        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <label className="inline-flex items-center gap-2">
            <input type="radio" name="note-type" value="admin" checked={type === "admin"} onChange={() => setType("admin")} className="accent-brand" />
            Internal (admins only)
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="radio" name="note-type" value="customer" checked={type === "customer"} onChange={() => setType("customer")} className="accent-brand" />
            Visible to customer
          </label>
        </div>
      </fieldset>
      <Field
        id="order-note"
        label="Note"
        error={error || undefined}
        hint={type === "customer" ? "Shown on the customer's order page. Email/SMS notifications are a later module." : "Never shown to the customer."}
      >
        <Textarea
          id="order-note"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={1000}
          className="min-h-20"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "order-note-error" : "order-note-hint"}
        />
      </Field>
      <div className="flex items-center justify-between gap-3">
        <p role="status" className="text-xs text-muted">{status}</p>
        <Button type="submit" size="sm" disabled={pending}>{pending ? "Adding…" : "Add note"}</Button>
      </div>
    </form>
  );
}

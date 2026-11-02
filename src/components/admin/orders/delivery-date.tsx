"use client";

import { useState, useTransition } from "react";
import { editOrderAction } from "@/app/admin/orders/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { formatDate } from "@/lib/format";
import { siteConfig } from "@/config/site";

/** Inline edit of the order's delivery date (Save / Cancel, no dialog). Recorded in the change history. */
export function DeliveryDateEditor({ orderId, date, editable }: { orderId: string; /** YYYY-MM-DD */ date?: string; editable: boolean }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(date ?? "");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const p = `dd-${orderId}`;

  const cancel = () => {
    setEditing(false);
    setValue(date ?? "");
    setReason("");
    setError("");
  };
  const save = () =>
    startTransition(async () => {
      const r = await editOrderAction(orderId, { kind: "delivery_date", date: value || null, reason });
      if (r.ok) {
        setEditing(false);
        setReason("");
        setError("");
      } else setError(r.message);
    });

  if (!editing) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span>
          <span className="text-muted">Delivery date: </span>
          {date ? formatDate(`${date}T00:00:00${siteConfig.utcOffset}`) : "not set"}
        </span>
        {editable && <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>{date ? "Change" : "Set date"}</Button>}
      </div>
    );
  }
  return (
    <form onSubmit={(e) => { e.preventDefault(); save(); }} className="space-y-2" noValidate>
      <label htmlFor={`${p}-date`} className="block text-sm font-medium">Delivery date</label>
      <Input id={`${p}-date`} type="date" value={value} onChange={(e) => setValue(e.target.value)} aria-invalid={Boolean(error)} aria-describedby={error ? `${p}-error` : undefined} />
      <label htmlFor={`${p}-reason`} className="block text-xs text-muted">Reason (optional)</label>
      <Input id={`${p}-reason`} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder="e.g. Customer asked for Thursday" />
      {error && <p id={`${p}-error`} role="alert" className="text-xs text-danger">{error}</p>}
      <div className="flex justify-end gap-2">
        {date && <Button variant="ghost" size="sm" onClick={() => setValue("")}>Clear</Button>}
        <Button variant="secondary" size="sm" onClick={cancel}>Cancel</Button>
        <Button type="submit" size="sm" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
      </div>
    </form>
  );
}

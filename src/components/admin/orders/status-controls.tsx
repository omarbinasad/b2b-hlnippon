"use client";

import { useState, useTransition } from "react";
import { updateOrderStatusAction } from "@/app/admin/orders/actions";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/field";
import { canTransition, nextStatus, orderStatusLabels } from "@/lib/orders/status";
import type { OrderStatus } from "@/lib/types";

/** Next delivery step and cancel (with a required reason). History is recorded by the server. */
export function OrderStatusControls({ orderId, status }: { orderId: string; status: OrderStatus }) {
  const next = nextStatus(status);
  const canCancel = canTransition(status, "cancelled");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  const change = (to: OrderStatus, note?: string) =>
    startTransition(async () => {
      setError("");
      setMessage("");
      const result = await updateOrderStatusAction(orderId, to, note);
      if (result.ok) {
        setCancelOpen(false);
        setReason("");
        setMessage(`Status changed to “${orderStatusLabels[to]}”. No message was sent to the customer.`);
      } else setError(result.message);
    });

  if (!next && !canCancel) return null;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {next && (
          <Button onClick={() => change(next)} disabled={pending}>
            {pending && !cancelOpen ? "Updating…" : `Mark as ${orderStatusLabels[next].toLowerCase()}`}
          </Button>
        )}
        {canCancel && (
          <Button variant="secondary" onClick={() => setCancelOpen(true)} disabled={pending}>
            Cancel order
          </Button>
        )}
      </div>
      <p role="status" className="text-sm text-muted">{message}</p>
      {error && !cancelOpen && <p role="alert" className="text-sm text-danger">{error}</p>}

      <Dialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Cancel this order?"
        description="The order leaves the delivery flow and can't be reopened in this demo. Payments are not refunded automatically."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            change("cancelled", reason);
          }}
          className="space-y-4"
        >
          <Field id="cancel-reason" label="Reason" required error={error || undefined} hint="Kept in the status history.">
            <Textarea
              id="cancel-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={300}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "cancel-reason-error" : "cancel-reason-hint"}
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setCancelOpen(false)}>Keep order</Button>
            <Button type="submit" variant="danger" disabled={pending}>{pending ? "Cancelling…" : "Cancel order"}</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}

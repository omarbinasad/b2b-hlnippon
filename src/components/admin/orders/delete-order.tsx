"use client";

import { useState, useTransition } from "react";
import { deleteOrderAction } from "@/app/admin/orders/actions";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

/** Only shown for an order that can be deleted: cancelled, with no payment, refund or invoice. */
export function DeleteOrderButton({ orderId, number }: { orderId: string; number: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return (
    <>
      <Button size="sm" variant="ghost" className="text-danger hover:bg-danger-soft" onClick={() => { setError(""); setOpen(true); }}>Delete order</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={`Delete order ${number}?`} description="This removes the cancelled order permanently. It can't be undone.">
        {error && <p role="alert" className="mb-3 text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setOpen(false)}>Keep order</Button>
          <Button variant="danger" disabled={pending} onClick={() => start(async () => { const r = await deleteOrderAction(orderId); if (r && !r.ok) setError(r.message); })}>{pending ? "Deleting…" : "Delete order"}</Button>
        </div>
      </Dialog>
    </>
  );
}

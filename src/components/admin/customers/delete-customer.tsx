"use client";

import { useState, useTransition } from "react";
import { deleteCustomerAction } from "@/app/admin/customers/actions";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

/** Only shown for a customer who has never ordered. */
export function DeleteCustomerButton({ customerId, name }: { customerId: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return (
    <>
      <Button variant="ghost" className="text-danger hover:bg-danger-soft" onClick={() => { setError(""); setOpen(true); }}>Delete customer</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={`Delete ${name}?`} description="This removes the account and its addresses permanently. It can't be undone.">
        {error && <p role="alert" className="mb-3 text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setOpen(false)}>Keep customer</Button>
          <Button variant="danger" disabled={pending} onClick={() => start(async () => { const r = await deleteCustomerAction(customerId); if (r && !r.ok) setError(r.message); })}>{pending ? "Deleting…" : "Delete customer"}</Button>
        </div>
      </Dialog>
    </>
  );
}

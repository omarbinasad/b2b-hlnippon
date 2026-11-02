"use client";

import { useState, useTransition } from "react";
import { reorderAction } from "@/app/(store)/actions";
import { Button } from "@/components/ui/button";

/** Adds a past order's products to the cart at today's prices (server-side), then opens the cart. */
export function ReorderButton({ orderId }: { orderId: string }) {
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <Button
        size="sm"
        variant="secondary"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const r = await reorderAction(orderId);
            if (r && !r.ok) setMessage(r.message);
          })
        }
      >
        {pending ? "Adding…" : "Order again"}
      </Button>
      {message && <span role="alert" className="max-w-64 text-right text-xs text-danger">{message}</span>}
    </span>
  );
}

"use client";

import { useState, useTransition } from "react";
import { deleteAddressAction, saveAddressAction } from "@/app/admin/customers/actions";
import { AddressBlock } from "@/components/order/order-details";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/feedback";
import type { Address, AddressInput } from "@/lib/types";
import { AddressForm } from "./address-form";

/** Multiple delivery and billing addresses; one default per type. */
export function AddressBook({ customerId, addresses, defaults }: { customerId: string; addresses: Address[]; defaults: Partial<AddressInput> }) {
  const [editing, setEditing] = useState<Address | "new" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Address | null>(null);
  const [status, setStatus] = useState("");
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; message?: string }>, done: string) =>
    startTransition(async () => {
      const result = await fn();
      setStatus(result.ok ? done : (result.message ?? "Something went wrong."));
    });

  const sorted = [...addresses].sort((a, b) => (a.type === b.type ? Number(b.isDefault) - Number(a.isDefault) : a.type === "shipping" ? -1 : 1));

  return (
    <div className="space-y-4">
      {sorted.length ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {sorted.map((a) => (
            <li key={a.id} className="flex flex-col rounded-ui border border-line p-3">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">{a.label}</span>
                <Badge tone={a.type === "shipping" ? "info" : "neutral"}>{a.type === "shipping" ? "Delivery" : "Billing"}</Badge>
                {a.isDefault && <Badge tone="success">Default</Badge>}
              </div>
              <AddressBlock address={a} />
              <div className="mt-3 flex flex-wrap gap-2 pt-1">
                <Button size="sm" variant="secondary" onClick={() => setEditing(a)} aria-label={`Edit address ${a.label}`}>Edit</Button>
                {!a.isDefault && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => run(() => saveAddressAction(customerId, { ...a, isDefault: true }), `“${a.label}” is now the default ${a.type === "shipping" ? "delivery" : "billing"} address.`)}
                  >
                    Make default
                  </Button>
                )}
                <Button size="sm" variant="ghost" className="text-danger" onClick={() => setConfirmDelete(a)} aria-label={`Delete address ${a.label}`}>Delete</Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="No addresses yet" description="Add a delivery address before creating orders for this customer." />
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p role="status" className="text-sm text-muted">{status}</p>
        <Button variant="secondary" onClick={() => setEditing("new")}>Add address</Button>
      </div>

      <Dialog open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "Add address" : "Edit address"} className="w-[min(40rem,calc(100vw-2rem))]">
        {editing && (
          <AddressForm
            customerId={customerId}
            address={editing === "new" ? undefined : editing}
            defaults={defaults}
            onDone={() => {
              setEditing(null);
              setStatus("Address book updated.");
            }}
          />
        )}
      </Dialog>

      <Dialog
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        title="Delete this address?"
        description="Past orders keep their own copy of the address, so they are not affected."
      >
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirmDelete(null)}>Keep</Button>
          <Button
            variant="danger"
            disabled={pending}
            onClick={() => {
              const a = confirmDelete!;
              setConfirmDelete(null);
              run(() => deleteAddressAction(customerId, a.id), `Deleted “${a.label}”.`);
            }}
          >
            Delete address
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

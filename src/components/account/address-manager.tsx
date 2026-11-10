"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteOwnAddressAction, lookupOwnPostcodeAction, saveOwnAddressAction } from "@/app/account/actions";
import { AddressForm } from "@/components/customers/address-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/feedback";
import { Icon } from "@/components/ui/icons";
import { formatAddressLines } from "@/lib/format";
import type { Address } from "@/lib/types";

/** Add, edit, delete and set default addresses. Checkout offers whatever is saved here. */
export function AddressManager({ addresses, defaults }: { addresses: Address[]; defaults: { companyName?: string; recipientName?: string; phone?: string } }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Address | "new" | null>(null);
  const [removing, setRemoving] = useState<Address | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const close = () => { setEditing(null); router.refresh(); };

  return (
    <div className="space-y-4">
      <Button onClick={() => setEditing("new")}><Icon name="plus" className="size-4" /> Add address</Button>
      {addresses.length ? (
        <ul className="grid gap-4 md:grid-cols-2">
          {addresses.map((a) => (
            <li key={a.id}>
              <Card
                title={a.label}
                actions={
                  <div className="flex gap-1">
                    <Badge>{a.type === "billing" ? "Billing" : "Delivery"}</Badge>
                    {a.isDefault && <Badge tone="brand">Default</Badge>}
                  </div>
                }
              >
                <address className="text-sm not-italic">
                  {a.companyName && <p>{a.companyName}</p>}
                  <p>{a.recipientName}</p>
                  {formatAddressLines(a).map((line) => <p key={line}>{line}</p>)}
                  <p className="mt-1 text-muted">{a.phone}</p>
                </address>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={() => setEditing(a)} aria-label={`Edit ${a.label}`}>Edit</Button>
                  {!a.isDefault && (
                    <Button size="sm" variant="ghost" disabled={pending} aria-label={`Make ${a.label} the default`} onClick={() => start(async () => { await saveOwnAddressAction({ ...a, isDefault: true }); router.refresh(); })}>Make default</Button>
                  )}
                  <Button size="sm" variant="ghost" className="text-danger hover:bg-danger-soft" aria-label={`Delete ${a.label}`} onClick={() => { setError(""); setRemoving(a); }}>Delete</Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      ) : <EmptyState title="No addresses saved" description="Add a delivery address to order." />}

      <Dialog open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "Add address" : "Edit address"} className="max-w-2xl">
        {editing !== null && (
          <AddressForm
            address={editing === "new" ? undefined : editing}
            defaults={defaults}
            save={saveOwnAddressAction}
            lookup={lookupOwnPostcodeAction}
            onDone={close}
          />
        )}
      </Dialog>
      <Dialog open={removing !== null} onClose={() => setRemoving(null)} title={`Delete "${removing?.label}"?`} description="Past orders keep their own copy of the address.">
        {error && <p role="alert" className="mb-3 text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setRemoving(null)}>Keep it</Button>
          <Button variant="danger" disabled={pending} onClick={() => start(async () => { if (!removing) return; const r = await deleteOwnAddressAction(removing.id); if (!r.ok) return setError(r.message); setRemoving(null); router.refresh(); })}>Delete</Button>
        </div>
      </Dialog>
    </div>
  );
}

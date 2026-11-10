"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteClassAction, deletePickupAction, saveClassAction, saveGeneralAction, savePickupAction, setMethodEnabledAction } from "@/app/admin/shipping/extras-actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Icon } from "@/components/ui/icons";
import { siteConfig } from "@/config/site";
import { formatMoney } from "@/lib/format";
import { amountStep } from "@/lib/orders/calc";
import type { ShippingGeneralSettings } from "@/lib/shipping/rules";
import type { FieldErrors, PickupLocation, ShippingClassUsage } from "@/lib/types";

/** Pause or resume one method in a zone from the methods overview. */
export function MethodToggle({ zoneId, methodId, name, enabled }: { zoneId: string; methodId: string; name: string; enabled: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <label className="inline-flex items-center gap-1.5 text-sm">
      <input type="checkbox" aria-label={`${name} enabled`} className="size-4 accent-brand" disabled={pending} checked={enabled} onChange={(e) => start(async () => { await setMethodEnabledAction(zoneId, methodId, e.target.checked); router.refresh(); })} />
      {enabled ? "On" : "Off"}
    </label>
  );
}

export function ClassManager({ classes }: { classes: ShippingClassUsage[] }) {
  const router = useRouter();
  const blank = { id: null as string | null, name: "", description: "", surcharge: "", surchargePer: "order" as "order" | "unit" };
  const [v, setV] = useState(blank);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [removeError, setRemoveError] = useState("");
  const [pending, start] = useTransition();
  const sym = siteConfig.currencySymbol;
  return (
    <div className="grid gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
      <Card title={v.id ? "Edit class" : "Add a class"}>
        <form
          noValidate
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await saveClassAction(v.id, v);
              if (!r.ok) return setErrors(r.errors);
              setErrors({});
              setV(blank);
              router.refresh();
            });
          }}
        >
          <Field id="cl-name" label="Name" required error={errors.name}><Input id="cl-name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? "cl-name-error" : undefined} /></Field>
          <Field id="cl-description" label="Description"><Input id="cl-description" value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field id="cl-fee" label={`Fee (${sym})`} error={errors.surcharge} hint="Added to the charge."><Input id="cl-fee" type="number" min={0} step={amountStep()} value={v.surcharge} onChange={(e) => setV({ ...v, surcharge: e.target.value })} aria-invalid={Boolean(errors.surcharge)} /></Field>
            <Field id="cl-per" label="Charged"><Select id="cl-per" value={v.surchargePer} onChange={(e) => setV({ ...v, surchargePer: e.target.value === "unit" ? "unit" : "order" })}><option value="order">Per order</option><option value="unit">Per unit</option></Select></Field>
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={pending}>{v.id ? "Save class" : "Add class"}</Button>
            {v.id && <Button variant="secondary" onClick={() => setV(blank)}>Cancel</Button>}
          </div>
        </form>
      </Card>
      <Card title="Classes" description="Assign a class to a product in its editor. Zones can also add their own charges per class.">
        {removeError && <p role="alert" className="mb-2 text-sm text-danger">{removeError}</p>}
        <ul className="divide-y divide-line">
          {classes.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <span className="min-w-0 text-sm">
                <span className="font-medium">{c.name}</span>
                <span className="block text-xs text-muted">{c.products} product{c.products === 1 ? "" : "s"}{c.surcharge ? ` · ${formatMoney(c.surcharge)} per ${c.surchargePer ?? "order"}` : ""}{c.description ? ` · ${c.description}` : ""}</span>
              </span>
              <span className="flex gap-2">
                <Button size="sm" variant="secondary" aria-label={`Edit ${c.name}`} onClick={() => { setRemoveError(""); setV({ id: c.id, name: c.name, description: c.description ?? "", surcharge: c.surcharge?.toString() ?? "", surchargePer: c.surchargePer ?? "order" }); }}>Edit</Button>
                <Button size="sm" variant="ghost" className="text-danger hover:bg-danger-soft" disabled={pending} aria-label={`Delete ${c.name}`} onClick={() => start(async () => { const r = await deleteClassAction(c.id); setRemoveError(r.ok ? "" : r.message); if (r.ok) router.refresh(); })}>Delete</Button>
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

export function PickupManager({ locations }: { locations: PickupLocation[] }) {
  const router = useRouter();
  const blank = { id: null as string | null, name: "", address: "", hours: "", instructions: "", fee: "0", enabled: true };
  const [v, setV] = useState(blank);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [removing, setRemoving] = useState<PickupLocation | null>(null);
  const [pending, start] = useTransition();
  const sym = siteConfig.currencySymbol;
  return (
    <div className="grid gap-6 lg:grid-cols-[24rem_minmax(0,1fr)]">
      <Card title={v.id ? "Edit pickup location" : "Add a pickup location"}>
        <form
          noValidate
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await savePickupAction(v.id, v);
              if (!r.ok) return setErrors(r.errors);
              setErrors({});
              setV(blank);
              router.refresh();
            });
          }}
        >
          <Field id="pk-name" label="Name" required error={errors.name}><Input id="pk-name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? "pk-name-error" : undefined} /></Field>
          <Field id="pk-address" label="Address" required error={errors.address}><Textarea id="pk-address" rows={2} value={v.address} onChange={(e) => setV({ ...v, address: e.target.value })} aria-invalid={Boolean(errors.address)} aria-describedby={errors.address ? "pk-address-error" : undefined} /></Field>
          <Field id="pk-hours" label="Hours"><Input id="pk-hours" value={v.hours} onChange={(e) => setV({ ...v, hours: e.target.value })} /></Field>
          <Field id="pk-instructions" label="Instructions"><Input id="pk-instructions" value={v.instructions} onChange={(e) => setV({ ...v, instructions: e.target.value })} /></Field>
          <Field id="pk-fee" label={`Pickup fee (${sym})`} error={errors.fee}><Input id="pk-fee" type="number" min={0} step={amountStep()} value={v.fee} onChange={(e) => setV({ ...v, fee: e.target.value })} aria-invalid={Boolean(errors.fee)} /></Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-brand" checked={v.enabled} onChange={(e) => setV({ ...v, enabled: e.target.checked })} /> Available</label>
          <div className="flex gap-2">
            <Button type="submit" disabled={pending}>{v.id ? "Save location" : "Add location"}</Button>
            {v.id && <Button variant="secondary" onClick={() => setV(blank)}>Cancel</Button>}
          </div>
        </form>
      </Card>
      <Card title="Pickup locations" description="To offer one, add a Local pickup method to a shipping zone and choose the location there.">
        {locations.length ? (
          <ul className="divide-y divide-line">
            {locations.map((l) => (
              <li key={l.id} className="flex flex-wrap items-start justify-between gap-2 py-3">
                <span className="min-w-0 text-sm">
                  <span className="font-medium">{l.name}</span>{!l.enabled && <span className="ml-2 text-xs text-muted">Unavailable</span>}
                  <span className="block text-xs text-muted">{l.address}</span>
                  <span className="block text-xs text-muted">{[l.hours, l.fee ? `Fee ${formatMoney(l.fee)}` : "No fee", l.instructions].filter(Boolean).join(" · ")}</span>
                </span>
                <span className="flex gap-2">
                  <Button size="sm" variant="secondary" aria-label={`Edit ${l.name}`} onClick={() => setV({ id: l.id, name: l.name, address: l.address, hours: l.hours ?? "", instructions: l.instructions ?? "", fee: String(l.fee), enabled: l.enabled })}>Edit</Button>
                  <Button size="sm" variant="ghost" className="text-danger hover:bg-danger-soft" aria-label={`Delete ${l.name}`} onClick={() => setRemoving(l)}><Icon name="trash" className="size-4" /></Button>
                </span>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-muted">No pickup locations yet.</p>}
      </Card>
      <Dialog open={removing !== null} onClose={() => setRemoving(null)} title={`Delete "${removing?.name}"?`} description="Zones using it keep their pickup method without the location details.">
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setRemoving(null)}>Keep it</Button>
          <Button variant="danger" disabled={pending} onClick={() => start(async () => { if (removing) await deletePickupAction(removing.id); setRemoving(null); router.refresh(); })}>Delete</Button>
        </div>
      </Dialog>
    </div>
  );
}

export function GeneralShippingForm({ settings }: { settings: ShippingGeneralSettings }) {
  const router = useRouter();
  const [v, setV] = useState(settings);
  const [status, setStatus] = useState("");
  const [pending, start] = useTransition();
  return (
    <form noValidate className="space-y-6" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await saveGeneralAction(v); setStatus(r.ok ? "Saved to the demo store." : r.message); router.refresh(); }); }}>
      <Card title="Checkout options">
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-0.5 size-4 accent-brand" checked={v.hidePaidWhenFree} onChange={(e) => setV({ ...v, hidePaidWhenFree: e.target.checked })} />
          <span>Hide paid delivery methods when free shipping is available<span className="block text-xs text-muted">Pickup stays available, so customers don&apos;t see conflicting options.</span></span>
        </label>
        <div className="mt-4">
          <Field id="ship-unavailable" label="Message when no method is available"><Textarea id="ship-unavailable" rows={2} value={v.unavailableMessage} onChange={(e) => setV({ ...v, unavailableMessage: e.target.value })} /></Field>
        </div>
      </Card>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save settings"}</Button>
        <p role="status" className="text-sm text-muted">{status}</p>
      </div>
    </form>
  );
}

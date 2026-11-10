"use client";

import { useCan } from "@/components/admin/capabilities-context";
import { useState, useTransition } from "react";
import { deleteBrandAction, saveBrandAction } from "@/app/admin/brands/actions";
import { ImagePick } from "@/components/admin/media/image-pick";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { Icon } from "@/components/ui/icons";
import type { AdminBrandRow, FieldErrors, SiteImage } from "@/lib/types";

/** Add or edit a brand: name, logo, and whether and where it shows on the homepage. */
function BrandDialog({ brand, open, onClose }: { brand?: AdminBrandRow; open: boolean; onClose: () => void }) {
  const [name, setName] = useState(brand?.name ?? "");
  const [logo, setLogo] = useState<SiteImage | null>(brand?.logo ?? null);
  const [showOnHome, setShowOnHome] = useState(brand?.showOnHome ?? false);
  const [displayOrder, setDisplayOrder] = useState(String(brand?.displayOrder ?? 0));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const p = `brand-${brand?.id ?? "new"}`;

  const save = () =>
    startTransition(async () => {
      setErrors({});
      setMessage("");
      const r = await saveBrandAction(brand?.id ?? null, { name, logo, showOnHome, displayOrder: displayOrder.trim() === "" ? Number.NaN : Number(displayOrder) });
      if (!r.ok) {
        setErrors(r.errors);
        setMessage(r.message);
        return;
      }
      onClose();
      if (!brand) {
        setName("");
        setLogo(null);
        setShowOnHome(false);
        setDisplayOrder("0");
      }
    });

  return (
    <Dialog open={open} onClose={onClose} title={brand ? `Edit ${brand.name}` : "Add brand"}>
      {/* The logo picker opens a dialog with its own form, so the fields join this one by id rather than sit inside it. */}
      <form id={`${p}-form`} noValidate onSubmit={(e) => { e.preventDefault(); save(); }} />
      <div className="space-y-4">
        <Field id={`${p}-name`} label="Name" required error={errors.name}>
          <Input id={`${p}-name`} form={`${p}-form`} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} aria-invalid={Boolean(errors.name)} />
        </Field>
        <div>
          <ImagePick label="Logo" contain value={logo} onChange={setLogo} hint="A PNG or WebP with a transparent or white background works best. Without a logo, the brand's name is shown." />
          {errors.logo && <p role="alert" className="mt-1 text-sm text-danger">{errors.logo}</p>}
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input id={`${p}-home`} form={`${p}-form`} type="checkbox" checked={showOnHome} onChange={(e) => setShowOnHome(e.target.checked)} className="mt-0.5 size-4 accent-brand" />
          <span>Show in the brands section on the homepage</span>
        </label>
        <Field id={`${p}-order`} label="Display order" hint="Lower numbers come first." error={errors.displayOrder}>
          <Input id={`${p}-order`} form={`${p}-form`} type="number" inputMode="numeric" min={0} step={1} value={displayOrder} onChange={(e) => setDisplayOrder(e.target.value)} aria-invalid={Boolean(errors.displayOrder)} />
        </Field>
        {message && <p role="alert" className="text-sm text-danger">{message}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form={`${p}-form`} disabled={pending}>{pending ? "Saving…" : brand ? "Save brand" : "Add brand"}</Button>
        </div>
      </div>
    </Dialog>
  );
}

export function AddBrandButton() {
  const can = useCan();
  const [open, setOpen] = useState(false);
  return (
    <>
      {can("products.edit") && <Button onClick={() => setOpen(true)}><Icon name="plus" className="size-4" /> Add brand</Button>}
      <BrandDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}

export function BrandRowActions({ brand }: { brand: AdminBrandRow }) {
  const can = useCan();
  const [editing, setEditing] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const remove = () =>
    startTransition(async () => {
      const r = await deleteBrandAction(brand.name);
      if (r.ok) setRemoving(false);
      else setError(r.message);
    });

  return (
    <div className="flex justify-end gap-2">
      {can("products.edit") && <Button size="sm" variant="secondary" onClick={() => setEditing(true)} aria-label={`Edit ${brand.name}`}>Edit</Button>}
      {can("products.delete") && <Button size="sm" variant="ghost" className="text-danger hover:bg-danger-soft" onClick={() => { setError(""); setRemoving(true); }} aria-label={`Delete ${brand.name}`}>Delete</Button>}
      {/* Remounts on each open, so the form always starts from the saved values. */}
      {editing && <BrandDialog brand={brand} open onClose={() => setEditing(false)} />}
      <Dialog
        open={removing}
        onClose={() => setRemoving(false)}
        title={`Delete ${brand.name}?`}
        description={brand.productCount ? `${brand.productCount} product${brand.productCount === 1 ? "" : "s"} will no longer have this brand. The products stay.` : "No products use this brand."}
      >
        {error && <p role="alert" className="mb-3 text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setRemoving(false)}>Keep brand</Button>
          <Button variant="danger" disabled={pending} onClick={remove}>{pending ? "Deleting…" : "Delete brand"}</Button>
        </div>
      </Dialog>
    </div>
  );
}

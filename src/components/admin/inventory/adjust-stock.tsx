"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { adjustStockAction } from "@/app/admin/inventory/actions";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import type { InventoryRow } from "@/lib/types";

export function AdjustStock({ row }: { row: InventoryRow }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [how, setHow] = useState<"set" | "add">("add");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<"in_stock" | "out_of_stock">(row.stock.status === "out_of_stock" ? "in_stock" : "out_of_stock");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [noteError, setNoteError] = useState("");
  const [pending, start] = useTransition();
  const id = `adj-${row.variationId ?? row.productId}`;
  const name = row.variationLabel ? `${row.productName} (${row.variationLabel})` : row.productName;
  const save = () =>
    start(async () => {
      const value = amount.trim() === "" ? Number.NaN : Number(amount);
      if (row.mode === "quantity" && !Number.isInteger(value)) return setError("Enter a whole number.");
      const body = row.mode === "status" ? { status, note } : how === "set" ? { quantity: value, note } : { delta: value, note };
      const r = await adjustStockAction(row.productId, row.variationId, body);
      if (!r.ok) {
        setError(r.errors.quantity ?? (r.errors.note ? "" : r.message));
        setNoteError(r.errors.note ?? "");
        return;
      }
      setOpen(false);
      setAmount("");
      setNote("");
      setError("");
      setNoteError("");
      router.refresh();
    });
  if (row.unavailable) return <span className="text-xs text-muted">{row.unavailable}</span>;
  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)} aria-label={`Adjust stock of ${name}`}>Adjust</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Adjust stock" description={name}>
        <form noValidate onSubmit={(e) => { e.preventDefault(); save(); }} className="space-y-4">
          {row.shared && <p className="text-sm text-warning">This option shares its stock with others on this product, so they change together.</p>}
          {row.mode === "quantity" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field id={`${id}-how`} label="Change">
                <Select id={`${id}-how`} value={how} onChange={(e) => setHow(e.target.value === "set" ? "set" : "add")}>
                  <option value="add">Add or remove units</option>
                  <option value="set">Set the count</option>
                </Select>
              </Field>
              <Field id={`${id}-amount`} label={how === "set" ? "New count" : "Units (use − to remove)"} required error={error} hint={`Now: ${row.stock.quantity ?? 0}`}>
                <Input id={`${id}-amount`} inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-amount-error` : `${id}-amount-hint`} />
              </Field>
            </div>
          ) : (
            <Field id={`${id}-status`} label="Availability" error={error}>
              <Select id={`${id}-status`} value={status} onChange={(e) => setStatus(e.target.value === "in_stock" ? "in_stock" : "out_of_stock")}>
                <option value="in_stock">In stock</option>
                <option value="out_of_stock">Out of stock</option>
              </Select>
            </Field>
          )}
          <Field id={`${id}-note`} label="Reason" required error={noteError} hint="Kept in the stock history.">
            <Input id={`${id}-note`} value={note} onChange={(e) => setNote(e.target.value)} aria-invalid={Boolean(noteError)} aria-describedby={noteError ? `${id}-note-error` : `${id}-note-hint`} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

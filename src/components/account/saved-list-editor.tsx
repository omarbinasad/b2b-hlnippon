"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addListItemAction, addListToCartAction, createListAction, createListFromOrderAction, deleteListAction, removeListItemAction, renameListAction, setListQuantityAction } from "@/app/account/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Notice } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/field";
import { Icon } from "@/components/ui/icons";
import { Table } from "@/components/ui/table";
import { formatMoney } from "@/lib/format";
import type { SavedListDetail, SavedListLine } from "@/lib/types";
import { ProductLinePicker } from "./product-line-picker";

export function NewListForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return (
    <form
      noValidate
      className="flex flex-wrap items-start gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await createListAction(name);
          if (!r.ok) return setError(r.errors.name ?? r.message);
          router.push(`/account/lists/${r.value.id}`);
        });
      }}
    >
      <div className="min-w-48 flex-1">
        <Input aria-label="New list name" placeholder="New list name" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={Boolean(error)} />
        {error && <p role="alert" className="mt-1 text-sm text-danger">{error}</p>}
      </div>
      <Button type="submit" disabled={pending}><Icon name="plus" className="size-4" /> Create list</Button>
    </form>
  );
}

/** "Save as list" on an order page. */
export function SaveOrderAsList({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="secondary"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await createListFromOrderAction(orderId);
          if (r.ok) router.push(`/account/lists/${r.value.id}`);
        })
      }
    >
      {pending ? "Saving…" : "Save as list"}
    </Button>
  );
}

function LineRow({ listId, line }: { listId: string; line: SavedListLine }) {
  const router = useRouter();
  const [qty, setQty] = useState(String(line.quantity));
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const save = (value: string) =>
    start(async () => {
      const r = await setListQuantityAction(listId, line.id, Number(value));
      setError(r.ok ? "" : r.message);
      if (r.ok) router.refresh();
    });
  return (
    <tr>
      <td className="min-w-52">
        <span className="font-medium">{line.name}</span>
        {line.optionLabel && <span className="block text-xs text-muted">{line.optionLabel}</span>}
        <span className="block text-xs text-muted">{line.sku}</span>
        {line.unavailable && <span className="block text-xs text-danger">{line.unavailable}</span>}
      </td>
      <td className="whitespace-nowrap">{line.unitPrice !== undefined ? formatMoney(line.unitPrice) : <span className="text-muted">—</span>}</td>
      <td className="w-28">
        <Input type="number" min={1} aria-label={`Quantity of ${line.name}`} value={qty} disabled={pending} onChange={(e) => setQty(e.target.value)} onBlur={(e) => { if (e.target.value !== String(line.quantity)) save(e.target.value); }} aria-invalid={Boolean(error)} />
        {error && <span role="alert" className="mt-1 block text-xs text-danger">{error}</span>}
      </td>
      <td className="text-right">
        <button type="button" aria-label={`Remove ${line.name}`} disabled={pending} onClick={() => start(async () => { await removeListItemAction(listId, line.id); router.refresh(); })} className="inline-grid size-9 place-items-center rounded-ui text-danger hover:bg-danger-soft">
          <Icon name="trash" className="size-4" />
        </button>
      </td>
    </tr>
  );
}

export function SavedListEditor({ list }: { list: SavedListDetail }) {
  const router = useRouter();
  const [name, setName] = useState(list.name);
  const [nameError, setNameError] = useState("");
  const [addError, setAddError] = useState("");
  const [cartResult, setCartResult] = useState<{ tone: "success" | "warning"; text: string } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-6">
      <Card title="List name">
        <form noValidate className="flex flex-wrap items-start gap-2" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await renameListAction(list.id, name); setNameError(r.ok ? "" : (r.errors.name ?? r.message)); if (r.ok) router.refresh(); }); }}>
          <div className="min-w-48 flex-1">
            <Field id="list-name" label="Name" error={nameError}><Input id="list-name" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={Boolean(nameError)} aria-describedby={nameError ? "list-name-error" : undefined} /></Field>
          </div>
          <Button type="submit" variant="secondary" className="sm:mt-7" disabled={pending}>Rename</Button>
          <Button variant="ghost" className="text-danger hover:bg-danger-soft sm:mt-7" onClick={() => setConfirming(true)}>Delete list</Button>
        </form>
      </Card>

      <Card title="Add a product">
        <ProductLinePicker onAdd={(l) => start(async () => { const r = await addListItemAction(list.id, l); setAddError(r.ok ? "" : r.message); if (r.ok) router.refresh(); })} addLabel="Add to list" />
        {addError && <p role="alert" className="mt-2 text-sm text-danger">{addError}</p>}
      </Card>

      {list.lines.length ? (
        <Table caption={`Products in ${list.name}`}>
          <thead>
            <tr>
              <th scope="col">Product</th>
              <th scope="col">Your price</th>
              <th scope="col">Quantity</th>
              <th scope="col" className="text-right"><span className="sr-only">Remove</span></th>
            </tr>
          </thead>
          <tbody>{list.lines.map((l) => <LineRow key={l.id} listId={list.id} line={l} />)}</tbody>
        </Table>
      ) : <p className="py-4 text-center text-sm text-muted">No products yet. Search above to add some.</p>}

      {cartResult && <Notice tone={cartResult.tone}>{cartResult.text}</Notice>}
      <Button
        disabled={pending || !list.lines.length}
        onClick={() =>
          start(async () => {
            const r = await addListToCartAction(list.id);
            if (!r.ok) return setCartResult({ tone: "warning", text: r.message });
            setCartResult({ tone: r.value.skipped.length ? "warning" : "success", text: `Added ${r.value.added} line${r.value.added === 1 ? "" : "s"} to your cart.${r.value.skipped.length ? ` Skipped: ${r.value.skipped.join(" ")}` : ""}` });
            router.refresh();
          })
        }
      >
        <Icon name="cart" className="size-4" /> Add list to cart
      </Button>

      <Dialog open={confirming} onClose={() => setConfirming(false)} title={`Delete "${list.name}"?`} description="This can't be undone. Your orders aren't affected.">
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirming(false)}>Keep it</Button>
          <Button variant="danger" disabled={pending} onClick={() => start(async () => { await deleteListAction(list.id); router.push("/account/lists"); })}>Delete list</Button>
        </div>
      </Dialog>
    </div>
  );
}
